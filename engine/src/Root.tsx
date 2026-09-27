import "./index.css";
import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import { MuseVideo, TOTAL_DURATION } from "./videos/muse-launch/MuseVideo";
import { WIDTH, HEIGHT, FPS } from "./videos/muse-launch/theme";
import { ClepLaunch, CLEP_DURATION, CLEP_FPS } from "./videos/clep-launch/ClepLaunch";
import { ClepStory, STORY_DURATION, STORY_FPS } from "./videos/clep-story/ClepStory";
import { FilmVideo, calculateFilmMetadata, FilmProps } from "./film/FilmVideo";
import { SpecVideo } from "./engine/SpecVideo";
import { VideoSpec, VideoSpecT } from "./engine/spec";
import { buildTimeline } from "./engine/timeline";
import { validateSpec } from "./engine/validate";
import demoSpec from "../examples/demo.spec.json";

// Every spec renders through ONE composition: pass the spec as input props
// (`--props=spec.json`). Size, fps and duration come from the spec itself.
const calculateSpecMetadata: CalculateMetadataFunction<VideoSpecT> = ({ props }) => {
  const res = validateSpec(props);
  if (!res.ok) throw new Error("Invalid VideoSpec:\n" + res.errors.join("\n"));
  const spec = res.spec;
  const fps = spec.format.fps;
  return {
    props: spec,
    fps,
    width: spec.format.width,
    height: spec.format.height,
    durationInFrames: buildTimeline(spec, fps).total,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Spec"
        component={SpecVideo}
        schema={VideoSpec}
        defaultProps={demoSpec as unknown as VideoSpecT}
        calculateMetadata={calculateSpecMetadata}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* Chat-made launch films: props written by director/filmspec.py. */}
      <Composition
        id="Film"
        component={FilmVideo}
        calculateMetadata={calculateFilmMetadata}
        defaultProps={{ brand: { name: "Brand", colors: { background: "#ffffff", foreground: "#111111", primary: "#3b6fe0" }, fonts: {}, screenshots: [] }, fps: 60, width: 1920, height: 1080, duration: 5, beats: [] } as FilmProps}
        durationInFrames={300}
        fps={60}
        width={1920}
        height={1080}
      />
      <Folder name="handbuilt">
        {/* Hand-coded reference video built straight from the kit (no spec). */}
        <Composition id="ClepStory" component={ClepStory} durationInFrames={STORY_DURATION} fps={STORY_FPS} width={1920} height={1080} />
        <Composition id="ClepLaunch" component={ClepLaunch} durationInFrames={CLEP_DURATION} fps={CLEP_FPS} width={1920} height={1080} />
        <Composition id="MuseLaunch" component={MuseVideo} durationInFrames={TOTAL_DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
      </Folder>
    </>
  );
};
