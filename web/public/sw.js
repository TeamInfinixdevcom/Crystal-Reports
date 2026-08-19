const DB_NAME = "crystal-reports-share";
const DB_VERSION = 1;
const STORE_NAME = "shared-files";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function saveSharedFile(file) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    const store = transaction.objectStore(STORE_NAME);

    const id =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const request = store.put({
      id,
      name: file.name || "archivo-compartido",
      type: file.type || "application/octet-stream",
      size: file.size,
      file,
      createdAt: Date.now(),
    });

    request.onsuccess = () => {
      resolve(id);
    };

    request.onerror = () => {
      reject(request.error);
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (
    request.method !== "POST" ||
    new URL(request.url).pathname !== "/compartir"
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const formData = await request.formData();

        const file = formData.get("file");

        if (!(file instanceof File)) {
          return Response.redirect(
            "/compartir?error=no-file",
            303,
          );
        }

        const fileId = await saveSharedFile(file);

        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        for (const client of clients) {
          client.postMessage({
            type: "SHARED_FILE_AVAILABLE",
            fileId,
          });

          await client.focus();
        }

        return Response.redirect(
          `/compartir?fileId=${encodeURIComponent(fileId)}`,
          303,
        );
      } catch (error) {
        console.error(
          "ERROR RECIBIENDO ARCHIVO COMPARTIDO:",
          error,
        );

        return Response.redirect(
          "/compartir?error=share-failed",
          303,
        );
      }
    })(),
  );
});

