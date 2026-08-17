self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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

        /*
         * Por ahora enviamos el archivo a cualquier ventana
         * de Crystal que esté abierta.
         *
         * En el siguiente paso agregaremos almacenamiento
         * temporal para soportar también la app cerrada.
         */

        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        for (const client of clients) {
          client.postMessage({
            type: "SHARED_FILE",
            file,
          });

          await client.focus();
        }

        return Response.redirect(
          "/compartir",
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