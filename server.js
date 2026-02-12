const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function safeFetch(url, options, timeoutMs) {
  try {
    return await fetchWithTimeout(url, options, timeoutMs);
  } catch {
    return null;
  }
}

function parseRssItems(xml, limit = 5) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = (block.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || '';
    items.push({ title, link, source, pubDate });
  }
  return items;
}

const SONG_POOL = {
  sad: [
    { title: 'Here Comes the Sun', artist: 'The Beatles', youtubeId: 'KQetemT1sWc', reason: 'A gentle reminder that brighter days are always ahead, even after the hardest times.' },
    { title: 'Three Little Birds', artist: 'Bob Marley', youtubeId: 'zaGUr6wzyT8', reason: 'Bob Marley\'s warm reassurance that every little thing is gonna be alright.' },
    { title: 'Happy', artist: 'Pharrell Williams', youtubeId: 'ZbZSe6N_BXs', reason: 'An infectious beat that makes it impossible not to smile and move your body.' },
    { title: 'Don\'t Stop Me Now', artist: 'Queen', youtubeId: 'HgzGwKwLmgM', reason: 'Pure joyful energy from Freddie Mercury to lift your spirits sky-high.' }
  ],
  angry: [
    { title: 'Don\'t Worry Be Happy', artist: 'Bobby McFerrin', youtubeId: 'd-diB65scQU', reason: 'A soothing whistle and carefree melody to help you let go of frustration.' },
    { title: 'Walking on Sunshine', artist: 'Katrina & the Waves', youtubeId: 'iPUmE-tne5U', reason: 'Bright, upbeat energy to transform tension into pure positive vibes.' },
    { title: 'Best Day of My Life', artist: 'American Authors', youtubeId: 'Y66j_BUCBMY', reason: 'An anthem to remind you that today can still be amazing despite the frustration.' },
    { title: 'Send Me on My Way', artist: 'Rusted Root', youtubeId: 'IGMabBGydC0', reason: 'A feel-good rhythm that channels your energy into something uplifting.' }
  ],
  happy: [
    { title: 'Good as Hell', artist: 'Lizzo', youtubeId: 'SmbmeOgWsqE', reason: 'Celebrate your great mood with Lizzo\'s empowering anthem of self-love.' },
    { title: 'Uptown Funk', artist: 'Bruno Mars', youtubeId: 'OPf0YbXqDm0', reason: 'Keep the good times rolling with this irresistible funk groove.' },
    { title: 'Shake It Off', artist: 'Taylor Swift', youtubeId: 'nfWlot6h_JM', reason: 'Match your happy energy with Taylor\'s carefree, dance-it-out anthem.' },
    { title: 'Can\'t Stop the Feeling!', artist: 'Justin Timberlake', youtubeId: 'ru0K8uYEZWw', reason: 'Pure sunshine in song form to keep your happiness going all day.' }
  ]
};

// Region-specific songs — keyed by country code for local artists in local language
const REGION_SONGS = {
  // Japan
  jp: {
    happy: [
      { title: 'Zen Zen Zense (前前前世)', artist: 'RADWIMPS', youtubeId: 'PDSkFeMVNFs', reason: 'A high-energy J-rock anthem from the movie "Your Name" to amplify your joy.' },
      { title: 'Happiness', artist: 'Arashi (嵐)', youtubeId: 'MvGEiMsHqgo', reason: 'Arashi\'s feel-good J-pop hit radiates pure sunshine energy.' },
    ],
    sad: [
      { title: 'Lemon (レモン)', artist: 'Kenshi Yonezu (米津玄師)', youtubeId: 'SX_ViT4Ra7k', reason: 'Kenshi Yonezu\'s beautiful melody gently lifts you from sadness with hope.' },
      { title: 'Pretender', artist: 'Official HIGE DANdism', youtubeId: 'TQ8WlA2GnHQ', reason: 'A soaring Japanese pop ballad that turns melancholy into something beautiful.' },
    ],
    angry: [
      { title: '紅蓮華 (Gurenge)', artist: 'LiSA', youtubeId: 'CwkzK-F0Y00', reason: 'LiSA\'s powerful vocals channel your intensity into an empowering anime anthem.' },
      { title: 'KICK BACK', artist: 'Kenshi Yonezu (米津玄師)', youtubeId: 'P8OjR8SLFKY', reason: 'A wildly energetic track to transform frustration into unstoppable momentum.' },
    ]
  },
  // South Korea
  kr: {
    happy: [
      { title: 'Dynamite', artist: 'BTS (방탄소년단)', youtubeId: 'gdZLi9oWNZg', reason: 'BTS brings explosive energy and joy with this global K-pop hit.' },
      { title: 'Gangnam Style (강남스타일)', artist: 'PSY', youtubeId: '9bZkp7q19f0', reason: 'The iconic K-pop party anthem straight from Seoul to keep your happy vibes going.' },
    ],
    sad: [
      { title: 'Spring Day (봄날)', artist: 'BTS (방탄소년단)', youtubeId: 'xEeFrLSkMm8', reason: 'A beautifully hopeful Korean ballad about longing that gently lifts your spirits.' },
      { title: 'Love Scenario (사랑을 했다)', artist: 'iKON', youtubeId: 'vecSVX1QYbQ', reason: 'A bittersweet K-pop melody that comforts and soothes when you\'re feeling down.' },
    ],
    angry: [
      { title: 'DDU-DU DDU-DU (뚜두뚜두)', artist: 'BLACKPINK', youtubeId: 'IHNzOHi8sJs', reason: 'BLACKPINK\'s fierce K-pop energy transforms anger into confident empowerment.' },
      { title: 'God\'s Menu (神메뉴)', artist: 'Stray Kids', youtubeId: 'TQTlCHxyuu8', reason: 'An intense K-pop banger to channel frustration into unstoppable power.' },
    ]
  },
  // Spain
  es: {
    happy: [
      { title: 'La Raja de Tu Falda', artist: 'Estopa', youtubeId: 'fEfCIBQtsjM', reason: 'Estopa\'s infectious rumba-pop from Barcelona keeps your happy vibes dancing.' },
      { title: 'Aserejé', artist: 'Las Ketchup', youtubeId: 'V0PisGe66mY', reason: 'Spain\'s most catchy pop hit radiates pure party energy.' },
    ],
    sad: [
      { title: 'Entre dos Aguas', artist: 'Paco de Lucía', youtubeId: '2oyhlad64-s', reason: 'Paco de Lucía\'s masterful flamenco guitar soothes the soul with its beauty.' },
      { title: 'La Puerta de Alcalá', artist: 'Ana Belén & Víctor Manuel', youtubeId: 'j2LX0ZXBWL8', reason: 'A beautiful Spanish ballad about Madrid that turns nostalgia into warmth.' },
    ],
    angry: [
      { title: 'Eres Tú', artist: 'Mocedades', youtubeId: 'OSVmltVMjMs', reason: 'A timeless Spanish anthem to redirect your energy into something uplifting.' },
      { title: 'Bailando', artist: 'Enrique Iglesias', youtubeId: 'NUsoVlDFqZg', reason: 'An irresistible Spanish dance track from Madrid to shake off frustration.' },
    ]
  },
  // Mexico
  mx: {
    happy: [
      { title: 'Cielito Lindo', artist: 'Traditional Mexican', youtubeId: 'L6Z5Nk3gJHM', reason: 'Mexico\'s beloved folk song fills your heart with pure Mexican joy.' },
      { title: 'La Bamba', artist: 'Ritchie Valens', youtubeId: 'Jp6j5HJ-Cok', reason: 'The iconic Mexican rock song that gets everyone on their feet.' },
    ],
    sad: [
      { title: 'Bésame Mucho', artist: 'Consuelo Velázquez', youtubeId: 'MhwICEFByYI', reason: 'Mexico\'s most famous bolero wraps you in warmth and hope.' },
      { title: 'Vivir Sin Aire', artist: 'Maná', youtubeId: 'EPrE9ee6tVE', reason: 'Maná\'s passionate rock ballad from Guadalajara transforms sadness into beautiful emotion.' },
    ],
    angry: [
      { title: 'De Música Ligera', artist: 'Soda Stereo', youtubeId: 'FRnQ80h2paA', reason: 'Latin rock\'s greatest anthem channels your energy into something powerful.' },
      { title: 'Ingrata', artist: 'Café Tacvba', youtubeId: 'ypYsFljKiUE', reason: 'Café Tacvba\'s Mexican rock classic channels frustration into raw musical genius.' },
    ]
  },
  // Argentina
  ar: {
    happy: [
      { title: 'La Maza', artist: 'Silvio Rodríguez', youtubeId: 'cuwQ6RhMHMs', reason: 'A poetic Latin American anthem that celebrates the beauty of life.' },
      { title: 'Me Gustas Tú', artist: 'Manu Chao', youtubeId: 'rs6Y4kZ8qtw', reason: 'Manu Chao\'s breezy hit radiates carefree Latin American happiness.' },
    ],
    sad: [
      { title: 'Alfonsina y el Mar', artist: 'Mercedes Sosa', youtubeId: '7G-yrVVzeSo', reason: 'Mercedes Sosa\'s voice from Tucumán gently lifts sadness into transcendent beauty.' },
      { title: 'Color Esperanza', artist: 'Diego Torres', youtubeId: 'Ot4lSY_bIHw', reason: 'Diego Torres\' Buenos Aires anthem reminds you to believe in hope.' },
    ],
    angry: [
      { title: 'Persiana Americana', artist: 'Soda Stereo', youtubeId: 'sSMDq8T0jTA', reason: 'Buenos Aires\' legendary Soda Stereo channels your intensity into pure rock energy.' },
      { title: 'Ji Ji Ji', artist: 'Los Redonditos de Ricota', youtubeId: 'HtMf6Yj1QIA', reason: 'Argentina\'s cult rock classic transforms frustration into raw power.' },
    ]
  },
  // Colombia
  co: {
    happy: [
      { title: 'La Bicicleta', artist: 'Shakira & Carlos Vives', youtubeId: 'Tskbql4EYgE', reason: 'A sunny Colombian pop hit from Barranquilla that radiates pure happiness.' },
      { title: 'La Tierra del Olvido', artist: 'Carlos Vives', youtubeId: 'pW-SOdDNJg0', reason: 'Carlos Vives\' Colombian classic celebrates the joy of his homeland.' },
    ],
    sad: [
      { title: 'La Camisa Negra', artist: 'Juanes', youtubeId: 'kRUKMo2UknQ', reason: 'Juanes\' Medellín hit transforms heartbreak into infectious Colombian rhythm.' },
      { title: 'A Dios le Pido', artist: 'Juanes', youtubeId: 'aW7Dz1SWiYc', reason: 'Juanes\' heartfelt Colombian anthem brings comfort through beautiful melody.' },
    ],
    angry: [
      { title: 'Waka Waka', artist: 'Shakira', youtubeId: 'pRpeEdMmmQ0', reason: 'Shakira\'s Barranquilla energy channels your frustration into a celebration.' },
      { title: 'Oye Como Va', artist: 'Tito Puente', youtubeId: 'FEwKT2dHk6E', reason: 'Latin percussion power to channel your intensity into unstoppable rhythm.' },
    ]
  },
  // France
  fr: {
    happy: [
      { title: 'Alors on danse', artist: 'Stromae', youtubeId: '7pKrVB5f2W0', reason: 'A French-language Eurobeat anthem that keeps your happy energy dancing.' },
      { title: 'Je veux', artist: 'Zaz', youtubeId: 'Tm88GxV4ud0', reason: 'Zaz\'s Parisian chanson celebrates the simple joyful pleasures of life.' },
    ],
    sad: [
      { title: 'La Vie en Rose', artist: 'Edith Piaf', youtubeId: '3Ba_WoSZXvw', reason: 'The timeless Parisian classic that wraps you in warmth and hope.' },
      { title: 'Ne me quitte pas', artist: 'Jacques Brel', youtubeId: 'eDuaFe0LULU', reason: 'Jacques Brel\'s legendary French chanson transforms sadness into breathtaking art.' },
    ],
    angry: [
      { title: 'Dernière Danse', artist: 'Indila', youtubeId: 'K5KAc5CoCuk', reason: 'Indila\'s dramatic French vocals channel intensity into something breathtakingly beautiful.' },
      { title: 'Formidable', artist: 'Stromae', youtubeId: 'S_xH7noaqTA', reason: 'Stromae\'s raw energy transforms frustration into a powerful French anthem.' },
    ]
  },
  // Belgium (French-speaking)
  be: {
    happy: [
      { title: 'Alors on danse', artist: 'Stromae', youtubeId: '7pKrVB5f2W0', reason: 'Brussels\' own Stromae brings infectious Eurobeat energy to match your joy.' },
      { title: 'Papaoutai', artist: 'Stromae', youtubeId: 'oiKj0Z_Xnjc', reason: 'Stromae\'s iconic Belgian hit keeps your energy high with its catchy rhythm.' },
    ],
    sad: [
      { title: 'Quand on n\'a que l\'amour', artist: 'Jacques Brel', youtubeId: 'bCMefT0OjCY', reason: 'Belgium\'s legendary Jacques Brel lifts sadness with his passionate artistry.' },
      { title: 'Formidable', artist: 'Stromae', youtubeId: 'S_xH7noaqTA', reason: 'Stromae\'s emotional Brussels anthem transforms melancholy into powerful beauty.' },
    ],
    angry: [
      { title: 'Ta Fête', artist: 'Stromae', youtubeId: 'UOBFnpjCpUk', reason: 'Stromae\'s energetic Belgian hit channels frustration into a celebratory beat.' },
      { title: 'Dernière Danse', artist: 'Indila', youtubeId: 'K5KAc5CoCuk', reason: 'Dramatic French-language vocals to channel your intensity beautifully.' },
    ]
  },
  // Germany
  de: {
    happy: [
      { title: '99 Luftballons', artist: 'Nena', youtubeId: 'La4Dcd1aUcE', reason: 'Nena\'s iconic German pop classic keeps the good vibes floating high.' },
      { title: 'Major Tom (Völlig Losgelöst)', artist: 'Peter Schilling', youtubeId: 'OMDbX1zksgI', reason: 'A German synth-pop adventure that matches your uplifted mood.' },
    ],
    sad: [
      { title: 'Atemlos durch die Nacht', artist: 'Helene Fischer', youtubeId: 'haECT-SerHk', reason: 'Germany\'s Helene Fischer sweeps away sadness with breathless joy.' },
      { title: 'Astronaut', artist: 'Sido ft. Andreas Bourani', youtubeId: 'XLp1LZ7LGQs', reason: 'A soaring German pop anthem about rising above when you\'re feeling low.' },
    ],
    angry: [
      { title: 'Du Hast', artist: 'Rammstein', youtubeId: 'W3q8Od5qJio', reason: 'Rammstein\'s Berlin industrial power channels your intensity into pure sonic force.' },
      { title: 'Rock Me Amadeus', artist: 'Falco', youtubeId: 'cVikZ8Ber6g', reason: 'Falco\'s legendary German-language track transforms frustration into rebellious fun.' },
    ]
  },
  // Austria
  at: {
    happy: [
      { title: 'Rock Me Amadeus', artist: 'Falco', youtubeId: 'cVikZ8Ber6g', reason: 'Vienna\'s own Falco keeps your happy vibes rocking with this classic.' },
      { title: 'Live Is Life', artist: 'Opus', youtubeId: 'EGikhmjTSZI', reason: 'Austria\'s Opus delivers a feel-good anthem that celebrates being alive.' },
    ],
    sad: [
      { title: 'Jeanny', artist: 'Falco', youtubeId: 'Urw-iutHw5E', reason: 'Falco\'s hauntingly beautiful Austrian ballad transforms emotion into art.' },
      { title: 'I Am from Austria', artist: 'Rainhard Fendrich', youtubeId: 'KMSa_xb2h5U', reason: 'A patriotic Austrian anthem that brings warmth and comfort.' },
    ],
    angry: [
      { title: 'Der Kommissar', artist: 'Falco', youtubeId: '8-bgFQ0jsow', reason: 'Falco\'s Vienna new wave classic channels intensity into cool confidence.' },
      { title: '99 Luftballons', artist: 'Nena', youtubeId: 'La4Dcd1aUcE', reason: 'An iconic German-language pop anthem to redirect your energy positively.' },
    ]
  },
  // Italy
  it: {
    happy: [
      { title: 'L\'Italiano', artist: 'Toto Cutugno', youtubeId: 'JDHvYbBEQEo', reason: 'A classic Italian celebration anthem that matches your joyful energy.' },
      { title: 'Felicità', artist: 'Al Bano & Romina Power', youtubeId: 'bZRzeUrVy1o', reason: 'Pure Italian happiness in song form — felicità means happiness!' },
    ],
    sad: [
      { title: 'Con Te Partirò', artist: 'Andrea Bocelli', youtubeId: 'TdWEhMOrRpQ', reason: 'Bocelli\'s soaring Italian tenor transforms sadness into breathtaking beauty.' },
      { title: 'Caruso', artist: 'Lucio Dalla', youtubeId: 'sHbKdM-1uoU', reason: 'A deeply moving Italian ballad inspired by Naples that turns melancholy into art.' },
    ],
    angry: [
      { title: 'Volare (Nel Blu Dipinto di Blu)', artist: 'Domenico Modugno', youtubeId: 'JMmOSlCvEAE', reason: 'Italy\'s most uplifting classic helps you soar above frustration.' },
      { title: 'Gloria', artist: 'Umberto Tozzi', youtubeId: 'Z_IG7j8FJIg', reason: 'An energetic Italian rock anthem to channel your intensity positively.' },
    ]
  },
  // Portugal
  pt: {
    happy: [
      { title: 'Lisboa Menina e Moça', artist: 'Carlos do Carmo', youtubeId: 'YPlz0lHQWGs', reason: 'Carlos do Carmo\'s Lisbon tribute radiates Portuguese warmth and joy.' },
      { title: 'Grândola, Vila Morena', artist: 'Zeca Afonso', youtubeId: 'gaLWrMR6VOs', reason: 'Portugal\'s revolutionary anthem celebrates freedom with uplifting spirit.' },
    ],
    sad: [
      { title: 'Estranha Forma de Vida', artist: 'Amália Rodrigues', youtubeId: 'D1tSRMXCJcE', reason: 'Portugal\'s fado queen Amália transforms sadness into hauntingly beautiful art.' },
      { title: 'Canção do Mar', artist: 'Dulce Pontes', youtubeId: 's-vMBr9yRWQ', reason: 'Dulce Pontes\' ocean ballad from Portugal soothes with its majestic beauty.' },
    ],
    angry: [
      { title: 'Cavaleiro Monge', artist: 'Moonspell', youtubeId: 'rK0la7GFEoE', reason: 'Portuguese metal powerhouse Moonspell channels your intensity into sonic strength.' },
      { title: 'Foi Deus', artist: 'Mariza', youtubeId: '4D1y3d9SXDM', reason: 'Mariza\'s powerful fado voice from Lisbon channels your energy passionately.' },
    ]
  },
  // Brazil
  br: {
    happy: [
      { title: 'Mas Que Nada', artist: 'Sergio Mendes & Brasil 66', youtubeId: 'zeBDoNBNMro', reason: 'The ultimate bossa nova party anthem straight from Rio de Janeiro.' },
      { title: 'Magalenha', artist: 'Sergio Mendes', youtubeId: 'oBvqPKVF4Zk', reason: 'Brazilian rhythms that amplify your happiness with infectious Bahia energy.' },
    ],
    sad: [
      { title: 'Garota de Ipanema', artist: 'Tom Jobim & Vinícius', youtubeId: 'UJkxFhXp8Qg', reason: 'The timeless bossa nova classic from Ipanema gently soothes and lifts your spirits.' },
      { title: 'Águas de Março', artist: 'Tom Jobim & Elis Regina', youtubeId: 'E1tOV7y94DY', reason: 'A gentle Brazilian reminder that after every rain, spring always comes.' },
    ],
    angry: [
      { title: 'Ai Se Eu Te Pego', artist: 'Michel Teló', youtubeId: 'hcm55lU9knw', reason: 'Michel Teló\'s catchy Brazilian sertanejo hit turns any mood into a dance party.' },
      { title: 'Aquarela do Brasil', artist: 'Ary Barroso', youtubeId: '05uWzUFvmvE', reason: 'Brazil\'s anthem of national pride channels your energy into celebration.' },
    ]
  },
  // China
  cn: {
    happy: [
      { title: '小苹果 (Little Apple)', artist: 'Chopstick Brothers (筷子兄弟)', youtubeId: 'APzcYMEBGdA', reason: 'China\'s most infectious Mandarin pop hit keeps your happiness bouncing.' },
      { title: '青花瓷 (Blue and White Porcelain)', artist: 'Jay Chou (周杰伦)', youtubeId: 'Z8Ij_n_3wfU', reason: 'Jay Chou\'s beautiful Chinese pop masterpiece elevates your joyful mood.' },
    ],
    sad: [
      { title: '晴天 (Sunny Day)', artist: 'Jay Chou (周杰伦)', youtubeId: 'DYptgVvkVLQ', reason: 'Jay Chou\'s nostalgic Mandarin ballad gently transforms sadness into hopeful warmth.' },
      { title: '月亮代表我的心 (The Moon Represents My Heart)', artist: 'Teresa Teng (邓丽君)', youtubeId: 'bv_cEeDlop0', reason: 'Teresa Teng\'s timeless Chinese love song wraps you in comfort and tenderness.' },
    ],
    angry: [
      { title: '双截棍 (Nunchucks)', artist: 'Jay Chou (周杰伦)', youtubeId: 'wnASjMRPbts', reason: 'Jay Chou\'s kung fu-themed Mandarin track channels your energy into powerful rhythm.' },
      { title: '龙拳 (Dragon Fist)', artist: 'Jay Chou (周杰伦)', youtubeId: 'MQ8VCRjHjbQ', reason: 'An empowering Mandarin hip-hop anthem to transform frustration into strength.' },
    ]
  },
  // Taiwan
  tw: {
    happy: [
      { title: '倒带 (Rewind)', artist: 'Jay Chou (周杰伦)', youtubeId: 'E_ON97s_Q_8', reason: 'Taiwan\'s own Jay Chou delivers a catchy Mandarin pop hit to match your joy.' },
      { title: '小幸運 (A Little Happiness)', artist: 'Hebe Tien (田馥甄)', youtubeId: '_sQSXwBAMAo', reason: 'Hebe Tien\'s sweet Taiwanese pop anthem celebrates little moments of happiness.' },
    ],
    sad: [
      { title: '听海 (Listen to the Sea)', artist: 'A-Mei (张惠妹)', youtubeId: 'oV--MnjH_SU', reason: 'A-Mei\'s powerful Taiwanese ballad transforms sadness into emotional beauty.' },
      { title: '后来 (Later)', artist: 'Rene Liu (刘若英)', youtubeId: '7u8lRFGnB7I', reason: 'Rene Liu\'s nostalgic Taiwanese ballad gently comforts with its tenderness.' },
    ],
    angry: [
      { title: '忍者 (Ninja)', artist: 'Jay Chou (周杰伦)', youtubeId: 'BoI-TaWNjf4', reason: 'Jay Chou\'s energetic Taiwanese hip-hop channels your intensity into cool power.' },
      { title: '以父之名 (In the Name of the Father)', artist: 'Jay Chou (周杰伦)', youtubeId: 'Bu7TB6yEnUI', reason: 'A dramatic Mandarin anthem from Taipei to transform frustration into cinematic power.' },
    ]
  },
  // Hong Kong
  hk: {
    happy: [
      { title: '海闊天空 (Boundless Oceans, Vast Skies)', artist: 'Beyond', youtubeId: 'qu_FSptjRic', reason: 'Hong Kong\'s legendary Beyond delivers an uplifting Cantonese rock anthem.' },
      { title: '喜歡你 (I Like You)', artist: 'Beyond', youtubeId: 'bt8LoxFDkpY', reason: 'Beyond\'s sweet Cantonese pop-rock classic matches your happy mood.' },
    ],
    sad: [
      { title: '千千闕歌 (A Thousand Songs)', artist: 'Anita Mui (梅艷芳)', youtubeId: 'VGRLCHEbfTI', reason: 'Hong Kong diva Anita Mui\'s iconic Cantonese ballad transforms sadness into beauty.' },
      { title: '月半小夜曲 (Half Moon Serenade)', artist: 'Leslie Cheung (张国荣)', youtubeId: 'xONfsGjhnQ4', reason: 'Leslie Cheung\'s legendary Cantonese ballad from Hong Kong soothes with its elegance.' },
    ],
    angry: [
      { title: '光輝歲月 (Glorious Years)', artist: 'Beyond', youtubeId: 'DF2YFJtGPqw', reason: 'Beyond\'s powerful Cantonese rock from Hong Kong channels intensity into inspiration.' },
      { title: '真的愛你 (Really Love You)', artist: 'Beyond', youtubeId: '8c7U5pyKh0E', reason: 'Hong Kong\'s iconic rock band transforms your energy into heartfelt power.' },
    ]
  },
  // Russia
  ru: {
    happy: [
      { title: 'Катюша (Katyusha)', artist: 'Russian Folk', youtubeId: '7J__ZdvsZaY', reason: 'Russia\'s beloved folk song brings warmth and joy to any day.' },
      { title: 'Натали (Natali)', artist: 'Блестящие', youtubeId: 'cjop3dOIjcA', reason: 'A catchy Russian pop hit that keeps the good vibes flowing.' },
    ],
    sad: [
      { title: 'Миллион алых роз (Million Scarlet Roses)', artist: 'Alla Pugacheva', youtubeId: 'oDtMS0lGZGI', reason: 'Alla Pugacheva\'s legendary Russian ballad comforts with its beautiful melody.' },
      { title: 'Городок (Little Town)', artist: 'Анжелика Варум', youtubeId: 'UqUX3iUOvaU', reason: 'A nostalgic Russian pop classic that gently lifts your spirits.' },
    ],
    angry: [
      { title: 'Полковнику никто не пишет', artist: 'Би-2', youtubeId: 'AWVXPLjf1Yc', reason: 'Bi-2\'s iconic Russian rock from Moscow channels intensity into powerful energy.' },
      { title: 'Кукушка (Cuckoo)', artist: 'Виктор Цой', youtubeId: 'BfEYMoSlsn4', reason: 'Viktor Tsoi\'s legendary Leningrad anthem transforms frustration into timeless power.' },
    ]
  },
  // India
  in: {
    happy: [
      { title: 'Chaiyya Chaiyya', artist: 'A.R. Rahman', youtubeId: 'YOYN9qNXmAw', reason: 'A.R. Rahman\'s iconic Bollywood track from Chennai fills you with pure joyful energy.' },
      { title: 'Kal Ho Naa Ho', artist: 'Sonu Nigam', youtubeId: 'g0eO74UmRBs', reason: 'A Mumbai Bollywood anthem about living in the moment and celebrating today.' },
    ],
    sad: [
      { title: 'Tum Hi Ho', artist: 'Arijit Singh', youtubeId: 'Umqb9KENgmk', reason: 'Arijit Singh\'s Hindi voice gently lifts sadness with beautiful Bollywood emotion.' },
      { title: 'Kun Faya Kun', artist: 'A.R. Rahman', youtubeId: 'T94PHkuydcw', reason: 'A.R. Rahman\'s spiritual masterpiece from Delhi brings peace and healing.' },
    ],
    angry: [
      { title: 'Zinda', artist: 'Siddharth Mahadevan', youtubeId: 'vFpsDoAdYQs', reason: 'An empowering Hindi Bollywood anthem that channels intensity into determination.' },
      { title: 'Kar Har Maidaan Fateh', artist: 'Sukhwinder Singh', youtubeId: 'fWsJlPMB_1Y', reason: 'A powerful Hindi motivational track to transform anger into victory spirit.' },
    ]
  },
  // Saudi Arabia
  sa: {
    happy: [
      { title: 'Ahwak', artist: 'Hussain Al Jassmi', youtubeId: 'T2Ov5uu9JjU', reason: 'A joyful Arabic pop hit that radiates Gulf-style warmth and celebration.' },
      { title: 'Tamally Maak', artist: 'Amr Diab', youtubeId: 'Rl4sYMGpLpM', reason: 'Amr Diab\'s timeless Arabic pop hit radiates warmth and happiness.' },
    ],
    sad: [
      { title: 'Nour El Ain', artist: 'Amr Diab', youtubeId: '4x8GkdYFajA', reason: 'Amr Diab\'s classic Arabic love song brings light to dark moments.' },
      { title: 'Ahwak', artist: 'Abdel Halim Hafez', youtubeId: 'hEvoyVe-x_I', reason: 'A timeless Arabic ballad that transforms sadness into beautiful longing.' },
    ],
    angry: [
      { title: '3 Daqat', artist: 'Abu ft. Yousra', youtubeId: 'mAIOY3pDJR8', reason: 'A vibrant Arabic pop track to turn frustration into dancing energy.' },
      { title: 'Batwanes Beek', artist: 'Warda', youtubeId: 'kzv71ZxaM-4', reason: 'Warda\'s powerful Arabic voice channels your intensity into passionate art.' },
    ]
  },
  // Egypt
  eg: {
    happy: [
      { title: 'Tamally Maak', artist: 'Amr Diab', youtubeId: 'Rl4sYMGpLpM', reason: 'Egypt\'s own Amr Diab delivers timeless Arabic pop warmth and happiness.' },
      { title: 'Ah W Noss', artist: 'Nancy Ajram', youtubeId: 'knJnmO7ISXQ', reason: 'Nancy Ajram\'s infectious Arabic dance hit from Cairo keeps the joy going.' },
    ],
    sad: [
      { title: 'Ahwak', artist: 'Abdel Halim Hafez', youtubeId: 'hEvoyVe-x_I', reason: 'Egypt\'s golden-age icon transforms sadness into timeless Arabic beauty.' },
      { title: 'Enta Omri', artist: 'Umm Kulthum', youtubeId: 'XPGHpBOt5sE', reason: 'Cairo\'s legendary Umm Kulthum brings deep comfort with her majestic Arabic voice.' },
    ],
    angry: [
      { title: '3 Daqat', artist: 'Abu ft. Yousra', youtubeId: 'mAIOY3pDJR8', reason: 'A vibrant Egyptian Arabic pop track to turn frustration into dancing energy.' },
      { title: 'Nour El Ain', artist: 'Amr Diab', youtubeId: '4x8GkdYFajA', reason: 'Amr Diab\'s iconic Egyptian hit channels your energy into uplifting rhythm.' },
    ]
  },
  // UAE
  ae: {
    happy: [
      { title: 'Tamally Maak', artist: 'Amr Diab', youtubeId: 'Rl4sYMGpLpM', reason: 'Amr Diab\'s timeless Arabic pop hit radiates Gulf celebration energy.' },
      { title: 'Ah W Noss', artist: 'Nancy Ajram', youtubeId: 'knJnmO7ISXQ', reason: 'Nancy Ajram\'s infectious Arabic dance hit keeps the Dubai vibes going.' },
    ],
    sad: [
      { title: 'Nour El Ain', artist: 'Amr Diab', youtubeId: '4x8GkdYFajA', reason: 'Amr Diab\'s classic Arabic love song brings light to dark moments.' },
      { title: 'Ahwak', artist: 'Abdel Halim Hafez', youtubeId: 'hEvoyVe-x_I', reason: 'A timeless Arabic ballad that transforms sadness into beautiful longing.' },
    ],
    angry: [
      { title: '3 Daqat', artist: 'Abu ft. Yousra', youtubeId: 'mAIOY3pDJR8', reason: 'A vibrant Arabic pop track to turn frustration into dancing energy.' },
      { title: 'Batwanes Beek', artist: 'Warda', youtubeId: 'kzv71ZxaM-4', reason: 'Warda\'s powerful Arabic voice channels your intensity into passionate art.' },
    ]
  },
  // Turkey
  tr: {
    happy: [
      { title: 'Şımarık (Kiss Kiss)', artist: 'Tarkan', youtubeId: '9VoLHdADma8', reason: 'Istanbul\'s own Tarkan keeps your happy energy dancing with this Turkish pop icon.' },
      { title: 'Dön Ne Olur', artist: 'Sezen Aksu', youtubeId: 'ixYL3OGm0JU', reason: 'Turkey\'s diva Sezen Aksu amplifies your joyful mood beautifully.' },
    ],
    sad: [
      { title: 'Dudu', artist: 'Tarkan', youtubeId: 'KZ2lWyTi9m0', reason: 'Tarkan\'s emotional Turkish ballad gently lifts your spirits with its warmth.' },
      { title: 'Gesi Bağları', artist: 'Barış Manço', youtubeId: 'sQC8NqHmrKU', reason: 'A Turkish Anatolian folk classic that turns sadness into hauntingly beautiful music.' },
    ],
    angry: [
      { title: 'Kazanova', artist: 'Tarkan', youtubeId: 'QiTLdP8gukE', reason: 'Tarkan\'s energetic Turkish beat channels frustration into confident swagger.' },
      { title: 'Yolla', artist: 'Tarkan', youtubeId: 'xQIad2gC7q8', reason: 'An upbeat Turkish pop anthem from Istanbul to transform anger into dance energy.' },
    ]
  },
  // Netherlands
  nl: {
    happy: [
      { title: 'Avond (Tulpen uit Amsterdam)', artist: 'André Hazes', youtubeId: 'cctBqRkNC2A', reason: 'Amsterdam\'s own André Hazes delivers a joyful Dutch classic to match your mood.' },
      { title: 'Ik Leef Niet Meer Voor Jou', artist: 'Marco Borsato', youtubeId: 'vMU7d_2-KXo', reason: 'Marco Borsato\'s upbeat Dutch pop keeps the good vibes rolling.' },
    ],
    sad: [
      { title: 'Het Is een Nacht', artist: 'Guus Meeuwis', youtubeId: 'bRlWmizhi3U', reason: 'Guus Meeuwis\' warm Dutch ballad gently lifts your spirits on a sad night.' },
      { title: 'Bloed, Zweet en Tranen', artist: 'André Hazes', youtubeId: 'DkLPz3FUJkc', reason: 'André Hazes\' emotional Amsterdam anthem transforms sadness into heartfelt Dutch soul.' },
    ],
    angry: [
      { title: 'Energie', artist: 'Marco Borsato', youtubeId: 'ECWxvEj3s6M', reason: 'Marco Borsato\'s energetic Dutch pop channels frustration into positive vibes.' },
      { title: 'Drank & Drugs', artist: 'Lil Kleine & Ronnie Flex', youtubeId: '_swivbEsD50', reason: 'Dutch hip-hop energy from Amsterdam to transform anger into raw beats.' },
    ]
  },
  // Sweden
  se: {
    happy: [
      { title: 'Dancing Queen', artist: 'ABBA', youtubeId: 'xFrGuyw1V8s', reason: 'Stockholm\'s own ABBA delivers the ultimate Swedish feel-good anthem.' },
      { title: 'Waterloo', artist: 'ABBA', youtubeId: 'Sj_9CiNkkn4', reason: 'ABBA\'s iconic Swedish pop keeps your happy energy at its peak.' },
    ],
    sad: [
      { title: 'The Winner Takes It All', artist: 'ABBA', youtubeId: 'iyIOl-s7JTU', reason: 'ABBA\'s emotional Swedish ballad transforms sadness into something hauntingly beautiful.' },
      { title: 'Sommaren är kort', artist: 'Tomas Ledin', youtubeId: 'mPg9btj2dHI', reason: 'A beloved Swedish summer anthem that brings warmth even on gray days.' },
    ],
    angry: [
      { title: 'Gimme! Gimme! Gimme!', artist: 'ABBA', youtubeId: 'XEjLoHdbVeE', reason: 'ABBA\'s driving Swedish disco-pop channels your energy into unstoppable rhythm.' },
      { title: 'The Final Countdown', artist: 'Europe', youtubeId: '9jK-NcRmVcw', reason: 'Sweden\'s Europe delivers an epic anthem to transform frustration into triumph.' },
    ]
  },
  // Poland
  pl: {
    happy: [
      { title: 'Zegarmistrz Światła', artist: 'Tadeusz Woźniak', youtubeId: 'mMVvQ6jJJIg', reason: 'A beloved Polish rock classic that radiates warmth and artistic joy.' },
      { title: 'Kocham Cię, Kochanie Moje', artist: 'Mrozu', youtubeId: 'xcOF2RNH6vQ', reason: 'Mrozu\'s sweet Polish pop hit matches your happy energy perfectly.' },
    ],
    sad: [
      { title: 'Jolka, Jolka', artist: 'Budka Suflera', youtubeId: 'qvn9tqxGvDs', reason: 'Budka Suflera\'s legendary Polish rock ballad comforts with its heartfelt melody.' },
      { title: 'Kołysanka', artist: 'Czesław Niemen', youtubeId: 'SXLCFf0jzXo', reason: 'Poland\'s iconic Niemen transforms melancholy into transcendent musical beauty.' },
    ],
    angry: [
      { title: 'Mam Tylko Ciebie', artist: 'Lady Pank', youtubeId: 'tMOqrEWPIlo', reason: 'Lady Pank\'s Polish rock energy from Warsaw channels frustration into power.' },
      { title: 'Nie Pytaj o Polskę', artist: 'Obywatel G.C.', youtubeId: 'wgocVgfHH9M', reason: 'A powerful Polish anthem that transforms anger into determined strength.' },
    ]
  },
  // Thailand
  th: {
    happy: [
      { title: 'ชาติ ชาย (Chat Chai)', artist: 'Bird Thongchai', youtubeId: 'B27SpHNPYbM', reason: 'Thailand\'s king of pop Bird Thongchai delivers infectious Thai happiness.' },
      { title: 'รักคุณเข้าแล้ว', artist: 'Palmy', youtubeId: 'sGlv2ggbPLk', reason: 'Palmy\'s sweet Thai pop hit from Bangkok amplifies your joyful mood.' },
    ],
    sad: [
      { title: 'คิดถึง (Miss You)', artist: 'Palmy', youtubeId: 'TuhTbGbJCZo', reason: 'Palmy\'s tender Thai ballad gently transforms sadness into beautiful emotion.' },
      { title: 'ยังคง (Still)', artist: 'Bodyslam', youtubeId: 'p0-m6uY8dT0', reason: 'Bodyslam\'s Thai rock ballad from Bangkok comforts with its heartfelt melody.' },
    ],
    angry: [
      { title: 'ก้าวไป (Move On)', artist: 'Bodyslam', youtubeId: 'JVLJz2QEJ8Y', reason: 'Thai rock band Bodyslam channels your frustration into empowering momentum.' },
      { title: 'ลุ้น', artist: 'Slot Machine', youtubeId: 'cXcY48WHKRY', reason: 'Thailand\'s Slot Machine delivers energetic Thai rock to redirect your intensity.' },
    ]
  },
  // Vietnam
  vn: {
    happy: [
      { title: 'See Tình', artist: 'Hoàng Thùy Linh', youtubeId: 'NmPHygkEe6A', reason: 'Vietnam\'s viral Vietnamese pop hit keeps your happy energy going strong.' },
      { title: 'Bống Bống Bang Bang', artist: '365DaBand', youtubeId: 'Y5EWlCqR2Hk', reason: 'A catchy Vietnamese pop anthem from Saigon that radiates pure fun.' },
    ],
    sad: [
      { title: 'Nơi Này Có Anh', artist: 'Sơn Tùng M-TP', youtubeId: 'FN7c_LNo1Zo', reason: 'Vietnam\'s pop star Sơn Tùng M-TP gently lifts sadness with his beautiful Vietnamese melody.' },
      { title: 'Em Của Ngày Hôm Qua', artist: 'Sơn Tùng M-TP', youtubeId: 'KGCL34c2bT8', reason: 'A soothing Vietnamese V-pop ballad that transforms melancholy into warm nostalgia.' },
    ],
    angry: [
      { title: 'Lạc Trôi', artist: 'Sơn Tùng M-TP', youtubeId: 'Llw9Q6akRo4', reason: 'Sơn Tùng M-TP\'s dramatic Vietnamese pop anthem channels intensity into epic power.' },
      { title: 'Hãy Trao Cho Anh', artist: 'Sơn Tùng M-TP ft. Snoop Dogg', youtubeId: 'knW7-x7Y7RE', reason: 'Vietnam\'s biggest hit transforms frustration into confident, cool energy.' },
    ]
  },
  // Indonesia
  id: {
    happy: [
      { title: 'Laskar Pelangi', artist: 'Nidji', youtubeId: 'IzJhOxuCWtQ', reason: 'Nidji\'s Indonesian pop anthem celebrates dreams and joy in Bahasa Indonesia.' },
      { title: 'Kangen', artist: 'Dewa 19', youtubeId: 'qn3y9pIbndQ', reason: 'Dewa 19\'s beloved Indonesian rock-pop radiates warmth from Jakarta.' },
    ],
    sad: [
      { title: 'Bukan Cinta Biasa', artist: 'Siti Nurhaliza', youtubeId: 'kWbqAu1pHT4', reason: 'A beautiful Malay ballad that gently comforts and lifts your spirits.' },
      { title: 'Cinta Luar Biasa', artist: 'Andmesh', youtubeId: '4OhOK-gBkgA', reason: 'Andmesh\'s tender Indonesian ballad transforms sadness into beautiful emotion.' },
    ],
    angry: [
      { title: 'Separuh Aku', artist: 'Noah', youtubeId: 'dkEQ-fxC9rU', reason: 'Noah\'s powerful Indonesian rock from Bandung channels your intensity into driving energy.' },
      { title: 'Bimbang', artist: 'Melly Goeslaw', youtubeId: 'dv5CZPfFjyY', reason: 'Melly Goeslaw\'s dramatic Indonesian vocals transform frustration into raw emotion.' },
    ]
  },
  // Philippines
  ph: {
    happy: [
      { title: 'Ikaw', artist: 'Yeng Constantino', youtubeId: 'DggaGm1CkiI', reason: 'Yeng\'s sweet Filipino pop anthem from Manila radiates pure joy.' },
      { title: 'Tala', artist: 'Sarah Geronimo', youtubeId: '-m2fVOmxvHk', reason: 'Sarah Geronimo\'s viral Filipino pop hit keeps your happy energy dancing.' },
    ],
    sad: [
      { title: 'Nandito Ako', artist: 'Ogie Alcasid', youtubeId: 'k8JQxWvzj6g', reason: 'Ogie\'s tender Filipino ballad gently lifts your spirits with its warmth.' },
      { title: 'Mundo', artist: 'IV of Spades', youtubeId: 'v7ALGdQoBfA', reason: 'IV of Spades\' beautiful Filipino rock ballad transforms sadness into art.' },
    ],
    angry: [
      { title: 'Eraserheads - Ang Huling El Bimbo', artist: 'Eraserheads', youtubeId: 'sNyp0gMhVdM', reason: 'The Philippines\' most iconic Filipino rock anthem channels energy into pure power.' },
      { title: 'Hari ng Sablay', artist: 'Sugarfree', youtubeId: '5aRxAKGWjTc', reason: 'Sugarfree\'s intense Filipino rock from Manila transforms frustration into catharsis.' },
    ]
  },
  // Greece
  gr: {
    happy: [
      { title: 'Χαρούμενες Μέρες', artist: 'Νότης Σφακιανάκης', youtubeId: 'hYM1PvKx8GE', reason: 'A joyful Greek pop hit that celebrates life with Mediterranean sunshine.' },
      { title: 'Zorba the Greek', artist: 'Mikis Theodorakis', youtubeId: '4UV3Nbkyufs', reason: 'The iconic Greek sirtaki that fills everyone with unstoppable joy.' },
    ],
    sad: [
      { title: 'To Tram to Teleftaio', artist: 'Haris Alexiou', youtubeId: 'Q6bvZP1Sk_o', reason: 'Greece\'s beloved Haris Alexiou transforms sadness into hauntingly beautiful Greek melody.' },
      { title: 'Stalia Stalia', artist: 'Giorgos Dalaras', youtubeId: 'NkMo3mRoPCE', reason: 'Dalaras\' powerful Greek voice gently comforts and lifts your spirits.' },
    ],
    angry: [
      { title: 'Zorba\'s Dance', artist: 'Mikis Theodorakis', youtubeId: '4UV3Nbkyufs', reason: 'The accelerating Greek sirtaki transforms your intensity into an unstoppable dance.' },
      { title: 'Eisai Ena Perivoli', artist: 'Stelios Kazantzidis', youtubeId: 'Kj5RDT-UJJg', reason: 'Greek rebetiko legend Kazantzidis channels raw emotion into powerful art.' },
    ]
  },
  // Israel
  il: {
    happy: [
      { title: 'Hava Nagila', artist: 'Traditional Hebrew', youtubeId: 'vHSNZK4Je-Y', reason: 'The iconic Hebrew celebration song fills your heart with pure communal joy.' },
      { title: 'Yalla Ya Nasrallah', artist: 'Israeli Folk', youtubeId: '65TBhEe6tEM', reason: 'A lively Hebrew folk tune that keeps the celebratory energy going.' },
    ],
    sad: [
      { title: 'Erev Shel Shoshanim', artist: 'Traditional Hebrew', youtubeId: '6m6ffoE2E9E', reason: 'A beautiful Hebrew love song that brings gentle comfort and warmth.' },
      { title: 'Hallelujah', artist: 'Gali Atari', youtubeId: 'jLg-bOgAuiQ', reason: 'Israel\'s Eurovision winner lifts sadness with its uplifting Hebrew melody.' },
    ],
    angry: [
      { title: 'Hava Nagila', artist: 'Traditional Hebrew', youtubeId: 'vHSNZK4Je-Y', reason: 'The driving Hebrew rhythm channels your energy into celebratory dance.' },
      { title: 'Bo\'i Kala', artist: 'Idan Raichel', youtubeId: 'T2SpG4nSRuI', reason: 'Idan Raichel\'s stirring Hebrew anthem from Tel Aviv transforms intensity into beauty.' },
    ]
  },
  // Ukraine
  ua: {
    happy: [
      { title: 'Shum', artist: 'Go_A', youtubeId: 'lqvzDkgok_g', reason: 'Go_A\'s viral Ukrainian folk-electronic hit keeps your happy energy surging.' },
      { title: 'Stefania', artist: 'Kalush Orchestra', youtubeId: 'UiEGVYOruLk', reason: 'Kalush Orchestra\'s Ukrainian Eurovision winner radiates heartfelt joy.' },
    ],
    sad: [
      { title: 'Обійми (Embrace)', artist: 'Okean Elzy', youtubeId: 'W6R2EJ9t5MU', reason: 'Ukraine\'s beloved Okean Elzy gently lifts sadness with this Ukrainian rock ballad.' },
      { title: 'Плине Кача', artist: 'Ukrainian Folk', youtubeId: 'Lu3L8bISpvk', reason: 'A deeply moving Ukrainian folk song that brings peace and healing.' },
    ],
    angry: [
      { title: 'Не Твоя Війна', artist: 'Okean Elzy', youtubeId: 'aCwOMKp3l90', reason: 'Okean Elzy\'s powerful Ukrainian rock from Kyiv channels intensity into strength.' },
      { title: 'Shum', artist: 'Go_A', youtubeId: 'lqvzDkgok_g', reason: 'Go_A\'s driving Ukrainian techno-folk transforms frustration into primal energy.' },
    ]
  },
  // Norway
  no: {
    happy: [
      { title: 'Take On Me', artist: 'a-ha', youtubeId: 'djV11Xbc914', reason: 'Norway\'s own a-ha delivers the ultimate feel-good Norwegian synth-pop classic.' },
      { title: 'The Fox (What Does the Fox Say?)', artist: 'Ylvis', youtubeId: 'jofNR_WkoCE', reason: 'Ylvis\' viral Norwegian comedy hit keeps your happy energy at maximum fun.' },
    ],
    sad: [
      { title: 'Hunting High and Low', artist: 'a-ha', youtubeId: 's6VaeFCxta8', reason: 'a-ha\'s beautiful Norwegian ballad transforms sadness into sweeping emotion.' },
      { title: 'The Sun Always Shines on T.V.', artist: 'a-ha', youtubeId: 'a3ir9HC9vYo', reason: 'a-ha\'s atmospheric track from Oslo gently lifts your spirits.' },
    ],
    angry: [
      { title: 'Take On Me', artist: 'a-ha', youtubeId: 'djV11Xbc914', reason: 'a-ha\'s driving Norwegian synth-pop channels your energy into unstoppable momentum.' },
      { title: 'In the Hall of the Mountain King', artist: 'Edvard Grieg', youtubeId: 'kLp_Hh6DKWc', reason: 'Norway\'s Grieg transforms intensity into a building crescendo of power.' },
    ]
  },
  // Denmark
  dk: {
    happy: [
      { title: 'Barbie Girl', artist: 'Aqua', youtubeId: 'ZyhrYis509A', reason: 'Denmark\'s Aqua delivers an irresistibly catchy Danish pop hit for pure fun.' },
      { title: 'MMMBop', artist: 'Lukas Graham', youtubeId: 'ItxWAl0YEys', reason: 'Lukas Graham\'s Danish pop from Copenhagen keeps good vibes flowing.' },
    ],
    sad: [
      { title: '7 Years', artist: 'Lukas Graham', youtubeId: 'LHCob76kigA', reason: 'Lukas Graham\'s reflective Danish pop gently transforms sadness into warm nostalgia.' },
      { title: 'Mama Said', artist: 'Lukas Graham', youtubeId: 'WuDh7xQYauk', reason: 'A heartfelt Danish track from Copenhagen that comforts with wisdom and warmth.' },
    ],
    angry: [
      { title: 'Doctor Jones', artist: 'Aqua', youtubeId: 'MJq0a6IBhco', reason: 'Aqua\'s energetic Danish Eurodance channels your frustration into fun.' },
      { title: 'Barbie Girl', artist: 'Aqua', youtubeId: 'ZyhrYis509A', reason: 'Denmark\'s iconic pop anthem makes it impossible to stay angry.' },
    ]
  },
  // Finland
  fi: {
    happy: [
      { title: 'Ievan Polkka', artist: 'Loituma', youtubeId: '7yh9i0PAjn4', reason: 'Finland\'s viral Finnish folk polka keeps your happiness bouncing infectiously.' },
      { title: 'Sandstorm', artist: 'Darude', youtubeId: 'y6120QOlsfU', reason: 'Finland\'s Darude delivers an iconic electronic anthem for peak energy.' },
    ],
    sad: [
      { title: 'Missä Muruseni On', artist: 'Olavi Virta', youtubeId: 'JKb6KhJRd8s', reason: 'Olavi Virta\'s classic Finnish tango gently transforms sadness into beautiful art.' },
      { title: 'Satumaa', artist: 'Reijo Taipale', youtubeId: 'vhkJj5KKtFE', reason: 'Finland\'s most beloved tango lifts your spirits with its dreamy Finnish melody.' },
    ],
    angry: [
      { title: 'Hard Rock Hallelujah', artist: 'Lordi', youtubeId: 'gAh9NRGNhUU', reason: 'Finland\'s Eurovision-winning Lordi channels your intensity into monster rock power.' },
      { title: 'Sandstorm', artist: 'Darude', youtubeId: 'y6120QOlsfU', reason: 'Darude\'s driving Finnish electronic beats transform frustration into pure adrenaline.' },
    ]
  },
  // Romania
  ro: {
    happy: [
      { title: 'Dragostea Din Tei (Numa Numa)', artist: 'O-Zone', youtubeId: 'YnopHCL1Jk8', reason: 'Romania\'s iconic Moldovan-Romanian pop hit keeps your joy at maximum.' },
      { title: 'De Ce Plâng Chitarele', artist: 'Mirabela Dauer', youtubeId: 'H2_SQDqNxL8', reason: 'A beloved Romanian pop classic that matches your happy energy.' },
    ],
    sad: [
      { title: 'Ciocârlia (The Lark)', artist: 'Romanian Folk', youtubeId: 'qMTSKLPl07E', reason: 'Romania\'s famous folk melody transforms sadness into soaring beauty.' },
      { title: 'De-ar Fi Să Vii', artist: 'Mihai Eminescu (set to music)', youtubeId: 'j0I-aVgPaYM', reason: 'A hauntingly beautiful Romanian ballad that turns melancholy into poetry.' },
    ],
    angry: [
      { title: 'Dragostea Din Tei', artist: 'O-Zone', youtubeId: 'YnopHCL1Jk8', reason: 'O-Zone\'s infectious Romanian Eurodance makes it impossible to stay frustrated.' },
      { title: 'Săru\' Mâna', artist: 'Smiley', youtubeId: 'T_dpSKpDW3Y', reason: 'Smiley\'s upbeat Romanian pop channels your energy into a dance party.' },
    ]
  },
  // Czech Republic
  cz: {
    happy: [
      { title: 'Jožin z Bažin', artist: 'Ivan Mládek', youtubeId: '5p0QtJMKt30', reason: 'The iconic Czech comedy-pop classic that brings pure joy and laughter.' },
      { title: 'Holky z Naší Školky', artist: 'Michal David', youtubeId: 'T2xJJjwKjWA', reason: 'Michal David\'s beloved Czech disco keeps your happy energy going.' },
    ],
    sad: [
      { title: 'Modlitba pro Martu', artist: 'Marta Kubišová', youtubeId: '0N8IwMcQd5w', reason: 'Marta Kubišová\'s legendary Czech anthem of hope gently lifts your spirits.' },
      { title: 'Srdce Nehasnou', artist: 'Lucie', youtubeId: 'x5jThKxFuTk', reason: 'Czech rock band Lucie\'s heartfelt ballad from Prague transforms sadness into warmth.' },
    ],
    angry: [
      { title: 'Jožin z Bažin', artist: 'Ivan Mládek', youtubeId: '5p0QtJMKt30', reason: 'This cult Czech classic channels your frustration into unstoppable fun.' },
      { title: 'Černí Andělé', artist: 'Lucie', youtubeId: 'bR50D0mPUt4', reason: 'Prague\'s Lucie delivers powerful Czech rock to channel your intensity.' },
    ]
  },
  // US (default English)
  us: {
    happy: [
      { title: 'Good as Hell', artist: 'Lizzo', youtubeId: 'SmbmeOgWsqE', reason: 'Lizzo\'s empowering American anthem of self-love matches your great mood.' },
      { title: 'Uptown Funk', artist: 'Bruno Mars', youtubeId: 'OPf0YbXqDm0', reason: 'Keep the good times rolling with this irresistible American funk groove.' },
    ],
    sad: [
      { title: 'Here Comes the Sun', artist: 'The Beatles', youtubeId: 'KQetemT1sWc', reason: 'A gentle reminder that brighter days are always ahead.' },
      { title: 'Three Little Birds', artist: 'Bob Marley', youtubeId: 'zaGUr6wzyT8', reason: 'Bob Marley\'s warm reassurance that every little thing is gonna be alright.' },
    ],
    angry: [
      { title: 'Don\'t Worry Be Happy', artist: 'Bobby McFerrin', youtubeId: 'd-diB65scQU', reason: 'A soothing melody to help you let go of frustration.' },
      { title: 'Walking on Sunshine', artist: 'Katrina & the Waves', youtubeId: 'iPUmE-tne5U', reason: 'Bright energy to transform tension into pure positive vibes.' },
    ]
  },
  // UK
  gb: {
    happy: [
      { title: 'Don\'t Stop Me Now', artist: 'Queen', youtubeId: 'HgzGwKwLmgM', reason: 'London\'s own Queen delivers pure joyful energy to lift you sky-high.' },
      { title: 'Mr. Brightside', artist: 'The Killers', youtubeId: 'gGdGFtwCNBE', reason: 'Britain\'s most beloved indie anthem keeps your happy energy rocking.' },
    ],
    sad: [
      { title: 'Here Comes the Sun', artist: 'The Beatles', youtubeId: 'KQetemT1sWc', reason: 'Liverpool\'s Beatles remind you that brighter days are always ahead.' },
      { title: 'Fix You', artist: 'Coldplay', youtubeId: 'k4V3Mo61fJM', reason: 'Coldplay\'s London anthem gently lifts sadness with its soaring hope.' },
    ],
    angry: [
      { title: 'Don\'t Look Back in Anger', artist: 'Oasis', youtubeId: 'r8OipmKFDeM', reason: 'Manchester\'s Oasis channels your anger into a timeless British rock anthem.' },
      { title: 'Bohemian Rhapsody', artist: 'Queen', youtubeId: 'fJ9rUzIMcZQ', reason: 'Queen\'s epic British masterpiece transforms intensity into musical genius.' },
    ]
  },
  // Australia
  au: {
    happy: [
      { title: 'Down Under', artist: 'Men at Work', youtubeId: 'XfR9iY5y94s', reason: 'Australia\'s unofficial anthem keeps your happy vibes going with Aussie spirit.' },
      { title: 'Somebody That I Used to Know', artist: 'Gotye', youtubeId: '8UVNT4wvIGY', reason: 'Melbourne\'s Gotye delivers an iconic Australian indie hit.' },
    ],
    sad: [
      { title: 'Beds Are Burning', artist: 'Midnight Oil', youtubeId: 'ejorQVy3m8E', reason: 'Midnight Oil\'s passionate Australian rock transforms sadness into purposeful energy.' },
      { title: 'The Horses', artist: 'Daryl Braithwaite', youtubeId: 'lnigc08J6FI', reason: 'An uplifting Australian classic that gently lifts your spirits.' },
    ],
    angry: [
      { title: 'Thunderstruck', artist: 'AC/DC', youtubeId: 'v2AC41dglnM', reason: 'Sydney\'s AC/DC channels your intensity into legendary Australian rock power.' },
      { title: 'Highway to Hell', artist: 'AC/DC', youtubeId: 'l482T0yNkeo', reason: 'AC/DC\'s iconic Australian anthem transforms frustration into raw rock energy.' },
    ]
  },
  // Canada
  ca: {
    happy: [
      { title: 'Call Me Maybe', artist: 'Carly Rae Jepsen', youtubeId: 'fWNaR-rxAic', reason: 'Canada\'s Carly Rae Jepsen delivers an irresistibly catchy Canadian pop hit.' },
      { title: 'Summer of \'69', artist: 'Bryan Adams', youtubeId: '9f06QZCVUHg', reason: 'Bryan Adams\' feel-good Canadian rock classic matches your happy energy.' },
    ],
    sad: [
      { title: 'Hallelujah', artist: 'Leonard Cohen', youtubeId: 'YrLk4vdY28Q', reason: 'Montreal\'s Leonard Cohen transforms sadness into transcendent Canadian beauty.' },
      { title: 'Skinny Love', artist: 'Birdy', youtubeId: 'aNzCDt2eidg', reason: 'A tender folk ballad that gently comforts and lifts your spirits.' },
    ],
    angry: [
      { title: 'You Oughta Know', artist: 'Alanis Morissette', youtubeId: 'NPcyTyilmYY', reason: 'Ottawa\'s Alanis Morissette channels raw anger into powerful Canadian rock catharsis.' },
      { title: 'Tom Sawyer', artist: 'Rush', youtubeId: 'auLBLk4ibAk', reason: 'Toronto\'s Rush transforms frustration into progressive Canadian rock genius.' },
    ]
  },
  // Ireland
  ie: {
    happy: [
      { title: 'Galway Girl', artist: 'Steve Earle', youtubeId: 'hB9bVAly1BQ', reason: 'A lively Irish folk anthem that fills you with the spirit of Galway.' },
      { title: 'Tell Me Ma', artist: 'Sham Rock', youtubeId: 'bD-hfBY0IWU', reason: 'A beloved Irish folk classic from Belfast that radiates pure joy.' },
    ],
    sad: [
      { title: 'Danny Boy', artist: 'Traditional Irish', youtubeId: 'kIdMwxcHf2c', reason: 'Ireland\'s most beloved folk ballad gently lifts sadness with its tender beauty.' },
      { title: 'Nothing Compares 2 U', artist: 'Sinéad O\'Connor', youtubeId: '0-EF60neguk', reason: 'Dublin\'s Sinéad O\'Connor transforms sadness into breathtaking Irish art.' },
    ],
    angry: [
      { title: 'Zombie', artist: 'The Cranberries', youtubeId: '6Ejga4kJUts', reason: 'Limerick\'s Cranberries channel your intensity into powerful Irish rock.' },
      { title: 'Sunday Bloody Sunday', artist: 'U2', youtubeId: 'EM4vblG6BVQ', reason: 'Dublin\'s U2 transforms anger into a timeless Irish anthem of passion.' },
    ]
  },
  // New Zealand
  nz: {
    happy: [
      { title: 'Royals', artist: 'Lorde', youtubeId: 'nlcIKh6sBtc', reason: 'Auckland\'s own Lorde delivers a cool New Zealand indie-pop anthem.' },
      { title: 'Don\'t Dream It\'s Over', artist: 'Crowded House', youtubeId: 'J9gKyRmic20', reason: 'New Zealand\'s Crowded House keeps your happy vibes going with this classic.' },
    ],
    sad: [
      { title: 'Pokarekare Ana', artist: 'Traditional Māori', youtubeId: 'vDSrT01T7I0', reason: 'New Zealand\'s most beloved Māori love song wraps you in gentle warmth.' },
      { title: 'Don\'t Dream It\'s Over', artist: 'Crowded House', youtubeId: 'J9gKyRmic20', reason: 'Crowded House\'s timeless Kiwi anthem transforms sadness into hopeful beauty.' },
    ],
    angry: [
      { title: 'Loyal', artist: 'Dave Dobbyn', youtubeId: 'VsONBjp2-as', reason: 'Dave Dobbyn\'s New Zealand anthem channels your energy into passionate Kiwi pride.' },
      { title: 'Green Garden', artist: 'Laura Mvula', youtubeId: '2DZ0BfhTLfc', reason: 'An uplifting anthem to redirect your frustration into positive momentum.' },
    ]
  },
};

const COUNTRY_TO_LANG = {
  us: { lang: 'en', locale: 'en-US' }, gb: { lang: 'en', locale: 'en-GB' }, au: { lang: 'en', locale: 'en-AU' },
  ca: { lang: 'en', locale: 'en-CA' }, nz: { lang: 'en', locale: 'en-NZ' }, ie: { lang: 'en', locale: 'en-IE' },
  es: { lang: 'es', locale: 'es-ES' }, mx: { lang: 'es', locale: 'es-MX' }, ar: { lang: 'es', locale: 'es-AR' },
  co: { lang: 'es', locale: 'es-CO' }, cl: { lang: 'es', locale: 'es-CL' }, pe: { lang: 'es', locale: 'es-PE' },
  fr: { lang: 'fr', locale: 'fr-FR' }, be: { lang: 'fr', locale: 'fr-BE' },
  de: { lang: 'de', locale: 'de-DE' }, at: { lang: 'de', locale: 'de-AT' }, ch: { lang: 'de', locale: 'de-CH' },
  it: { lang: 'it', locale: 'it-IT' },
  pt: { lang: 'pt', locale: 'pt-PT' }, br: { lang: 'pt', locale: 'pt-BR' },
  jp: { lang: 'ja', locale: 'ja-JP' },
  kr: { lang: 'ko', locale: 'ko-KR' },
  cn: { lang: 'zh', locale: 'zh-CN' }, tw: { lang: 'zh', locale: 'zh-TW' }, hk: { lang: 'zh', locale: 'zh-HK' },
  ru: { lang: 'ru', locale: 'ru-RU' },
  in: { lang: 'hi', locale: 'hi-IN' },
  sa: { lang: 'ar', locale: 'ar-SA' }, eg: { lang: 'ar', locale: 'ar-EG' }, ae: { lang: 'ar', locale: 'ar-AE' },
  nl: { lang: 'nl', locale: 'nl-NL' },
  se: { lang: 'sv', locale: 'sv-SE' },
  pl: { lang: 'pl', locale: 'pl-PL' },
  tr: { lang: 'tr', locale: 'tr-TR' },
  th: { lang: 'th', locale: 'th-TH' },
  vn: { lang: 'vi', locale: 'vi-VN' },
  id: { lang: 'id', locale: 'id-ID' },
  ph: { lang: 'tl', locale: 'fil-PH' },
  gr: { lang: 'el', locale: 'el-GR' },
  il: { lang: 'he', locale: 'he-IL' },
  ua: { lang: 'uk', locale: 'uk-UA' },
  ro: { lang: 'ro', locale: 'ro-RO' },
  cz: { lang: 'cs', locale: 'cs-CZ' },
  no: { lang: 'no', locale: 'nb-NO' },
  dk: { lang: 'da', locale: 'da-DK' },
  fi: { lang: 'fi', locale: 'fi-FI' },
};

app.get('/api/lookup', async (req, res) => {
  const city = req.query.city;
  const mood = req.query.mood;
  if (!city) {
    return res.status(400).json({ error: 'City is required.' });
  }

  try {
    // 1. Geocode city
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=1`;
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'WorldClockGreetingApp/1.0' }
    });
    const geoData = await geoRes.json();

    if (!geoData.length) {
      return res.status(404).json({ error: `Could not find a city named "${city}".` });
    }

    const { lat, lon, display_name, address } = geoData[0];
    const countryCode = (address && address.country_code) || 'us';
    const langInfo = COUNTRY_TO_LANG[countryCode] || { lang: 'en', locale: 'en-US' };

    // 2. Get timezone, weather, and news in parallel (each independent)
    const overpassQuery = `[out:json][timeout:10];node["amenity"="restaurant"](around:1000,${lat},${lon});out 8;`;
    const [timeRes, weatherRes, aqiRes, newsRes, restaurantRes] = await Promise.all([
      safeFetch(`https://timeapi.io/api/time/current/coordinate?latitude=${lat}&longitude=${lon}`),
      safeFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph`),
      safeFetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10`),
      safeFetch(`https://news.google.com/rss/search?q=${encodeURIComponent(city)}&hl=en-US&gl=US&ceid=US:en`, {
        headers: { 'User-Agent': 'WorldClockGreetingApp/1.0' }
      }),
      safeFetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`
      })
    ]);

    // Timezone — try API, fall back to letting the client figure it out
    let timeZone = null;
    if (timeRes && timeRes.ok) {
      const timeData = await timeRes.json();
      timeZone = timeData.timeZone;
    }

    let weather = null;
    if (weatherRes && weatherRes.ok) {
      const wd = await weatherRes.json();
      weather = wd.current;
    }

    let airQuality = null;
    if (aqiRes && aqiRes.ok) {
      const aq = await aqiRes.json();
      airQuality = aq.current;
    }

    let news = [];
    if (newsRes && newsRes.ok) {
      const rssXml = await newsRes.text();
      news = parseRssItems(rssXml, 5);
    }

    let restaurants = [];
    if (restaurantRes && restaurantRes.ok) {
      const rd = await restaurantRes.json();
      restaurants = (rd.elements || [])
        .filter(e => e.tags && e.tags.name)
        .map(e => ({
          name: e.tags.name,
          cuisine: e.tags.cuisine || null,
          lat: e.lat,
          lon: e.lon
        }));
    }

    // Pick a song based on mood and region (country code)
    let song = null;
    if (mood && SONG_POOL[mood]) {
      const regionPool = REGION_SONGS[countryCode] && REGION_SONGS[countryCode][mood];
      const pool = regionPool || SONG_POOL[mood];
      song = pool[Math.floor(Math.random() * pool.length)];
    }

    res.json({
      displayName: display_name,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      lang: langInfo.lang,
      locale: langInfo.locale,
      timeZone,
      weather,
      airQuality,
      news,
      restaurants,
      song
    });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
