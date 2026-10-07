import { createRef, createElement } from "react";
import {
  SeamPlayer,
  type SeamPlayerHandle,
  type SeamPlayerProps,
  type SeamSource,
  type SeamThumbnails,
  type SeamCaption,
  type SeamChapter,
  type SeamDownload,
  type SeamTheme,
} from "seamplayer";
const src: SeamSource[] = [{ src: "/film.mp4", height: 720 }];
const thumbnails: SeamThumbnails = {
  url: "/sprite.jpg",
  width: 160,
  height: 90,
  columns: 10,
  count: 20,
  interval: 1,
};
const captions: SeamCaption[] = [
  { src: "/en.vtt", lang: "en", label: "English" },
];
const chapters: SeamChapter[] = [{ start: 0, title: "Intro" }];
const download: SeamDownload = { url: "/film.mp4" };
const theme: SeamTheme = { accent: "red" };
const props: SeamPlayerProps = {
  src,
  thumbnails,
  captions,
  chapters,
  download,
  theme,
};
createElement(SeamPlayer, { ...props, ref: createRef<SeamPlayerHandle>() });
