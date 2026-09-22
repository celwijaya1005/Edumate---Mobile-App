// Avatar default (ikon siluet orang generik) buat fallback kalau user
// belum punya foto profil. Gambarnya sendiri disimpan sebagai file asset
// biasa di assets/images/default-avatar.png — bukan base64 di dalam kode,
// biar gampang diganti/diedit langsung filenya kapan aja.
//
// Image.resolveAssetSource() dipakai supaya hasilnya tetap berupa STRING
// (bukan module reference angka dari require()), karena di seluruh app
// avatar diperlakukan sebagai string biasa lewat pola `{ uri: someAvatar }`.

import { Image } from 'react-native';

export const DEFAULT_AVATAR_URI = Image.resolveAssetSource(
  require('../assets/images/default-avatar.png')
).uri;