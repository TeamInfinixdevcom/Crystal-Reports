import "./firebase";

import {getApp} from "firebase/app";
import {getFunctions, httpsCallable} from "firebase/functions";

const functions = getFunctions(getApp());

export const testGemini = httpsCallable<
  Record<string, never>,
  {
    success: boolean;
    response: string;
  }
>(functions, "testGemini");

export const listGeminiModels = httpsCallable<
  Record<string, never>,
  {
    success: boolean;
    models: {
      name: string;
      displayName?: string;
    }[];
  }
>(functions, "listGeminiModels");