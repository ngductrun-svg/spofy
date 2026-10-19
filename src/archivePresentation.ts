import variants from './archiveVariants.json';
import { archiveAsset } from './archiveAssets';

export const activityDescriptions: Record<string, string> = {
  'event-01': 'Một góc giao lưu khoa học tại Giảng Võ, với các thiết bị thí nghiệm được giới thiệu trong sân trường.',
  'event-39': 'Những khoảnh khắc tại Pharos Fair 2024, cùng ảnh tập thể trước các bảng SPOFY và Pharos Fair.',
  'event-51': 'Một buổi gặp gỡ được lưu bằng ảnh tập thể bên lá cờ SPOFY. Thời gian trên thẻ là ngày đăng ảnh trong tư liệu.',
};
const curatedAlt: Record<string, string> = {
  '2398722950352153': 'Những người tham gia quan sát thiết bị thí nghiệm trên bàn dưới ô trong sân trường.',
  '448405177786849': 'Nhóm người mặc áo xanh chụp ảnh trên sân khấu, phía trước có bảng SPOFY và Pharos Fair 24.',
  '1903481897668235': 'Nhóm người chụp ảnh trong phòng với lá cờ đen mang chữ SPOFY.',
};
export function photoAlt(photo: {id:string;alt?:string;event?:string}) { return curatedAlt[photo.id] || photo.alt || photo.event || 'Ảnh tư liệu hoạt động SPOFY'; }
export function photoSources(photo: {id:string;image:string;thumb:string}) {
  const widths = variants[photo.id];
  if (!widths) return undefined;
  // Actual decoded widths, not fabricated CDN variants. Equal widths use the
  // full image once rather than producing invalid duplicate srcset descriptors.
  const sources = new Map<number,string>([[widths[0],archiveAsset(photo.thumb)],[widths[1],archiveAsset(photo.image)]]);
  return [...sources].sort(([a],[b])=>a-b).map(([width,src])=>`${src} ${width}w`).join(', ');
}
