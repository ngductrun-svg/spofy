export type EventPhoto = {
  src: string;
  caption: string;
  alt: string;
};

export type EventGroup = {
  id: 'gen10' | 'pharos' | 'station' | 'odyssey';
  label: string;
  date: string;
  title: string;
  description: string;
  source: string;
  sourceLabel: string;
  cover?: string;
  photos: EventPhoto[];
};

export type Milestone = {
  year: string;
  date: string;
  title: string;
  description: string;
  source: string;
  sourceLabel: string;
  image?: string;
  album?: EventGroup['id'];
};

const facebook = 'https://www.facebook.com/spofy.sofia';
const firstMeetingPost =
  'https://www.facebook.com/spofy.sofia/posts/pfbid0wfnR1np4XwSTdPpp7st4ymuE9arcEiz4vWjkXkaiKA6cNYSkanEkxQgPydhxR8JSl';
const pharosSource =
  'https://vov2.vov.vn/giao-duc-dao-tao/pharos-fair-dem-khoa-hoc-gan-hon-voi-hoc-sinh-pho-thong-48429.vov2';
const stationSource =
  'https://chuyennguyenhue.com/science-station-2025-science-earth-and-heart/';
const odysseySource =
  'https://www.facebook.com/pharos.spofy/posts/pfbid02SZ4qEiSqikkurDQduBCnq9NuvKewR4F8wjd1nzxzw692EDfudwAoXBYNgrVxG7Dvl';

export const eventGroups: EventGroup[] = [
  {
    id: 'gen10',
    label: 'GEN 10',
    date: '29.09',
    title: 'First Meeting — khởi đầu một hành trình',
    description:
      'Những gương mặt mới, những lời chào đầu tiên. GEN 10 cùng làm quen, kết nối và bắt đầu viết tiếp câu chuyện của SPOFY.',
    source: firstMeetingPost,
    sourceLabel: 'Facebook SPOFY · RECAP FIRST MEETING',
    photos: [
      {
        src: '/images/first-meeting-01.jpg',
        caption: 'Cùng nhau bắt đầu chương mới của GEN 10.',
        alt: 'Khoảnh khắc First Meeting của SPOFY GEN 10, ảnh 1',
      },
      {
        src: '/images/first-meeting-02.jpg',
        caption: 'Những lời chào và cuộc gặp gỡ đầu tiên.',
        alt: 'Khoảnh khắc First Meeting của SPOFY GEN 10, ảnh 2',
      },
      {
        src: '/images/first-meeting-03.jpg',
        caption: 'Làm quen với những người bạn cùng đam mê.',
        alt: 'Khoảnh khắc First Meeting của SPOFY GEN 10, ảnh 3',
      },
      {
        src: '/images/first-meeting-04.jpg',
        caption: 'Từng cuộc trò chuyện tạo nên sự gắn kết.',
        alt: 'Khoảnh khắc First Meeting của SPOFY GEN 10, ảnh 4',
      },
      {
        src: '/images/first-meeting-05.jpg',
        caption: 'Một khởi đầu để cùng khám phá và trưởng thành.',
        alt: 'Khoảnh khắc First Meeting của SPOFY GEN 10, ảnh 5',
      },
    ],
  },
  {
    id: 'pharos',
    label: 'PHAROS FAIR 4',
    date: '2024',
    title: 'Khi khoa học bước ra khỏi trang sách',
    description:
      'Thí nghiệm, board game và những câu hỏi đầy tò mò. Pharos Fair 4 tạo không gian để học sinh trực tiếp khám phá Vật lý, Hóa học, Sinh học và Kỹ thuật.',
    source: pharosSource,
    sourceLabel: 'VOV2',
    photos: [
      {
        src: '/images/pharos-fair-2024-01.jpg',
        caption: 'Một góc hội chợ Pharos Fair 4.',
        alt: 'Không gian hội chợ khoa học Pharos Fair mùa thứ tư',
      },
      {
        src: '/images/pharos-fair-2024-02.jpg',
        caption: 'SPOFY biểu diễn thí nghiệm tại Hội thi STEM Hà Nội.',
        alt: 'Thành viên SPOFY trình diễn thí nghiệm núi lửa tại Hội thi STEM Hà Nội năm 2024',
      },
      {
        src: '/images/pharos-fair-2024-03.jpg',
        caption: 'Tự tay thử nghiệm, tự mình khám phá.',
        alt: 'Học sinh trải nghiệm thí nghiệm với sự hướng dẫn của ban tổ chức Pharos Fair',
      },
      {
        src: '/images/pharos-fair-2024-04.jpg',
        caption: 'Tập thể SPOFY cùng lưu lại một mùa Pharos.',
        alt: 'Ảnh tập thể thành viên SPOFY tại Pharos Fair 4',
      },
    ],
  },
  {
    id: 'station',
    label: 'SCIENCE STATION',
    date: '13.04.2025',
    title: 'Trao tri thức, gửi yêu thương',
    description:
      'SPOFY và COSMOS mang Science Heart đến THPT Lương Sơn, Hòa Bình. Những gian thí nghiệm và món quà quyên góp kết nối khoa học với cộng đồng.',
    source: stationSource,
    sourceLabel: 'CNH Spotlight',
    photos: [
      {
        src: '/images/science-heart-2025-01.jpg',
        caption: 'Điểm đến: THPT Lương Sơn, Hòa Bình.',
        alt: 'Cổng điểm trường THPT Lương Sơn, Hòa Bình',
      },
      {
        src: '/images/science-heart-2025-02.jpg',
        caption: 'Phát biểu khai mạc của thầy giáo.',
        alt: 'Thầy giáo phát biểu trong phần khai mạc Science Heart',
      },
      {
        src: '/images/science-heart-2025-03.jpg',
        caption: 'COSMOS mở đầu ngày hội khoa học.',
        alt: 'Đại diện câu lạc bộ COSMOS phát biểu khai mạc Science Station',
      },
      {
        src: '/images/science-heart-2025-04.jpg',
        caption: 'Thí nghiệm mở màn đầy hào hứng.',
        alt: 'Thành viên COSMOS biểu diễn thí nghiệm trên sân khấu Science Heart',
      },
      {
        src: '/images/science-heart-2025-05.jpg',
        caption: 'Những ánh mắt háo hức khám phá.',
        alt: 'Học sinh hưởng ứng màn trình diễn thí nghiệm khoa học',
      },
      {
        src: '/images/science-heart-2025-06.jpg',
        caption: 'Khám phá khoa học tại gian hàng.',
        alt: 'Học sinh trải nghiệm một gian thí nghiệm của Science Heart, ảnh 1',
      },
      {
        src: '/images/science-heart-2025-07.jpg',
        caption: 'Cùng trải nghiệm những điều mới.',
        alt: 'Học sinh trải nghiệm một gian thí nghiệm của Science Heart, ảnh 2',
      },
      {
        src: '/images/science-heart-2025-08.jpg',
        caption: 'Một góc ngày hội Science Heart.',
        alt: 'Hoạt động khám phá thí nghiệm tại Science Heart',
      },
      {
        src: '/images/science-heart-2025-09.jpg',
        caption: 'Tò mò là điểm khởi đầu.',
        alt: 'Học sinh tập trung tìm hiểu thí nghiệm khoa học, ảnh 1',
      },
      {
        src: '/images/science-heart-2025-10.jpg',
        caption: 'Kiến thức đến từ trải nghiệm.',
        alt: 'Học sinh tập trung tìm hiểu thí nghiệm khoa học, ảnh 2',
      },
      {
        src: '/images/science-heart-2025-11.jpg',
        caption: 'Khép lại một ngày cùng nhau.',
        alt: 'Ảnh tập thể Science Station tại Lương Sơn ngày 13 tháng 4 năm 2025',
      },
    ],
  },
  {
    id: 'odyssey',
    label: 'PHAROS FAIR 26',
    date: '2026',
    title: 'Odyssey — những dấu chân giữa biển khơi',
    description:
      'Pharos, sự kiện chính của SPOFY, tiếp tục hành trình với Odyssey. Những thí nghiệm, tiết mục sân khấu và khoảnh khắc cùng khám phá lưu lại nhiệt huyết của một ngày hội khoa học.',
    source: odysseySource,
    sourceLabel: 'Facebook Pharos Fair',
    cover: '/images/pharos-odyssey-03.jpg',
    photos: [
      {
        src: '/images/pharos-odyssey-01.jpg',
        caption: 'Khoảnh khắc chia sẻ trên sân khấu Pharos Fair.',
        alt: 'Một người cầm micro và giấy trước phông sân khấu Pharos Fair 26.',
      },
      {
        src: '/images/pharos-odyssey-02.jpg',
        caption: 'Âm nhạc góp nhịp vui cho ngày hội.',
        alt: 'Tiết mục ca hát cùng đàn guitar và đàn phím trên sân khấu Pharos Fair 26.',
      },
      {
        src: '/images/pharos-odyssey-03.jpg',
        caption: 'Thí nghiệm ngọn lửa thắp sáng sân khấu.',
        alt: 'Hai người trình diễn thí nghiệm với ngọn lửa trước phông Pharos Fair 26.',
      },
      {
        src: '/images/pharos-odyssey-04.jpg',
        caption: 'Khoảnh khắc trình diễn thí nghiệm với lửa.',
        alt: 'Màn trình diễn thí nghiệm ngọn lửa trên sân khấu Pharos Fair 26.',
      },
      {
        src: '/images/pharos-odyssey-05.jpg',
        caption: 'Cùng quan sát một hoạt động thí nghiệm tại gian hàng.',
        alt: 'Người tham dự quan sát hoạt động được hướng dẫn tại gian hàng Pharos Fair.',
      },
    ],
  },
];

export const milestones: Milestone[] = [
  {
    year: '2017',
    date: '10.08.2017',
    title: 'Một ý tưởng bắt đầu',
    description:
      'SPOFY được thành lập tại Trường THPT Chuyên Khoa học Tự nhiên, mở một nơi gặp gỡ cho những người trẻ cùng đam mê khoa học.',
    source: facebook,
    sourceLabel: 'Giới thiệu chính thức · Facebook SPOFY',
  },
  {
    year: '2018',
    date: '2018',
    title: 'Science Station ra đời',
    description:
      'SPOFY và COSMOS cùng xây dựng Science Station, một dự án kết nối khoa học với cộng đồng học sinh.',
    source: stationSource,
    sourceLabel: 'CNH Spotlight',
  },
  {
    year: '2020',
    date: '21.06.2020 · theo lịch công bố',
    title: 'Noosphere — Avatar',
    description:
      'Với chủ đề Avatar, Noosphere giới thiệu những góc nhìn mới về khoa học qua board game, Rubik và cờ vua.',
    source:
      'https://khoinghieptre.tuoitrethudo.vn/kham-pha-khoa-hoc-voi-hoc-tro-thu-do-tai-quotnoosphere-2020quot-10035.html',
    sourceLabel: 'Lịch công bố và poster · Tuổi Trẻ Thủ Đô',
    image: '/images/noosphere-2020-poster.png',
  },
  {
    year: '2021',
    date: '2021',
    title: 'Pharos Fair — hội chợ của trí tò mò',
    description:
      'Pharos Fair kết nối thí nghiệm, trò chơi tư duy và Escape Room, mời người trẻ tự trải nghiệm và khám phá những góc nhìn khác nhau về khoa học.',
    source:
      'https://phapluat.tuoitrethudo.vn/pharos-fair-2021-goc-nhin-da-chieu-ve-the-gioi-khoa-hoc-nhiem-mau-58355.html',
    sourceLabel: 'Tuổi Trẻ Thủ Đô',
  },
  {
    year: '2023',
    date: '03–30.10.2023',
    title: 'Đồng hành cùng STEM Challenges',
    description:
      'SPOFY dịch thử thách STEM của Đại học Quốc gia Úc sang tiếng Việt và hỗ trợ học sinh phát triển, triển khai ý tưởng.',
    source:
      'https://hsgs.edu.vn/vi/thong-tin-huu-ich/danh-cho-hoc-sinh/giao-luu-a-hop-tac-quoc-te/1960-thong-bao-ve-cuoc-thi-thu-thach-stem-2023-stem-challenges-2023',
    sourceLabel: 'Thông báo · Trường THPT Chuyên Khoa học Tự nhiên',
  },
  {
    year: '2024',
    date: '2024',
    title: 'Pharos Fair bước sang mùa 4',
    description:
      'Hội chợ mở rộng trải nghiệm khoa học. Ngày 11/05, SPOFY còn mang gian thí nghiệm đến Hội thi STEM Hà Nội tại THCS Thăng Long.',
    source: pharosSource,
    sourceLabel: 'VOV2',
    image: '/images/pharos-fair-2024-04.jpg',
    album: 'pharos',
  },
  {
    year: '2025',
    date: '13.04.2025',
    title: 'Science Heart đến Lương Sơn',
    description:
      'SPOFY và COSMOS cùng học sinh THPT Lương Sơn khám phá thí nghiệm, chia sẻ những món quà và niềm yêu thích khoa học.',
    source: stationSource,
    sourceLabel: 'CNH Spotlight',
    image: '/images/science-heart-2025-11.jpg',
  },
  {
    year: '2026',
    date: '18.05.2026 · bài recap',
    title: 'Pharos Fair 26 — Odyssey',
    description:
      'Odyssey viết tiếp câu chuyện của Pharos với những màn trình diễn thí nghiệm, âm nhạc và trải nghiệm tại gian hàng. Từng khoảnh khắc lưu lại tinh thần cùng khám phá của SPOFY.',
    source: odysseySource,
    sourceLabel: 'Facebook Pharos Fair',
    image: '/images/pharos-odyssey-03.jpg',
    album: 'odyssey',
  },
];
