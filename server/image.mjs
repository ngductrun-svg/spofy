import { fail } from './errors.mjs';

export function inspectImage(buffer, contentType) {
  let width = 0, height = 0, mime, extension;
  if (contentType === 'image/png' && buffer.length >= 45 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.toString('ascii', 12, 16) === 'IHDR') {
    // Require a bounded chunk stream ending at IEND rather than trusting just a magic prefix.
    let at = 8, ended = false;
    while (at + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(at);
      if (length > buffer.length - at - 12) break;
      const type = buffer.toString('ascii', at + 4, at + 8);
      at += length + 12;
      if (type === 'IEND') { ended = length === 0 && at === buffer.length; break; }
    }
    if (!ended || buffer.readUInt32BE(8) !== 13) fail(422, 'INVALID_IMAGE', 'Cấu trúc ảnh PNG không hợp lệ.');
    width = buffer.readUInt32BE(16); height = buffer.readUInt32BE(20); mime = 'image/png'; extension = 'png';
  } else if (contentType === 'image/jpeg' && buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) {
    let at = 2;
    while (at + 4 < buffer.length) {
      if (buffer[at++] !== 0xff) break;
      while (buffer[at] === 0xff) at++;
      const marker = buffer[at++];
      if ([0xd8, 0xd9, 0x01].includes(marker) || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = buffer.readUInt16BE(at);
      if (length < 2 || at + length > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) { height = buffer.readUInt16BE(at + 3); width = buffer.readUInt16BE(at + 5); break; }
      if (marker === 0xda) break;
      at += length;
    }
    mime = 'image/jpeg'; extension = 'jpg';
  } else fail(415, 'IMAGE_TYPE', 'Chỉ chấp nhận tệp PNG hoặc JPEG thực sự.');
  if (!width || !height || width > 8000 || height > 8000 || width * height > 32_000_000) fail(422, 'IMAGE_DIMENSIONS', 'Ảnh cần có kích thước hợp lệ, tối đa 8000 px mỗi cạnh và 32 megapixel.');
  return { width, height, mime, extension };
}
