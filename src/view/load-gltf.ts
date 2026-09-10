import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** The baked meshes in public/meshes are meshopt compressed, so every loader needs the decoder. */
export const withMeshopt = (loader: GLTFLoader) => loader.setMeshoptDecoder(MeshoptDecoder);
