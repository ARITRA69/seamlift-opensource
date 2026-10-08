import { SeamPlayer, type SeamPlayerProps } from "seamplayer";
import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { DocLink, H3, P, Section } from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";
import {
  buildPlayerProps,
  defaultConfig,
  generateExample,
  type PlaygroundConfig,
} from "@/lib/playground";

const href = "/seamplayer/showcase";
export const metadata = docsMetadata(seamplayer, href);

function recipe(
  config: Partial<PlaygroundConfig>,
  extra: Partial<SeamPlayerProps> = {}
): SeamPlayerProps {
  return {
    ...buildPlayerProps({ ...defaultConfig, resume: false, ...config }),
    ...extra,
  };
}

const recipes = [
  {
    id: "minimal",
    title: "Minimal",
    description:
      "One file and a poster, in your page’s own font. Nothing to set up beyond the source.",
    props: recipe({
      source: "single",
      thumbnails: false,
      chapters: false,
      captions: false,
      download: false,
      share: false,
      font: "system",
      radius: "8px",
    }),
  },
  {
    id: "editorial",
    title: "Editorial",
    description:
      "Square corners and the Sun accent, with the filmstrip and chapters for scanning a long cut.",
    props: recipe({
      captions: false,
      download: false,
      accent: "sun",
      radius: "0px",
    }),
  },
  {
    id: "course-lesson",
    title: "Course lesson",
    description:
      "Captions, chapters, resume where each learner stopped, and a button to the next lesson at the end.",
    props: recipe(
      { download: false, share: false, resume: true, radius: "24px" },
      {
        resumeKey: "showcase-course-lesson",
        endAction: { label: "Next lesson", href: "/seamplayer/showcase" },
      }
    ),
  },
] as const;

const productionProps = recipe({});

export default function ShowcasePage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <Section id="in-production" title="In production">
        <H3 id="seamlift">Seamlift</H3>
        <P>
          Seamplayer is the video player inside{" "}
          <DocLink href="https://seamlift.com">Seamlift</DocLink>. This is
          Seamlift’s brand film with every media tool on: three sizes, the
          filmstrip, chapters, captions, downloads, and links to a moment.
        </P>
        <SeamPlayer {...productionProps} />
      </Section>
      <Section id="recipes" title="Recipes">
        <P>
          Common setups built from the same demo film. Open the code to copy a
          complete component.
        </P>
        {recipes.map((item) => (
          <div key={item.id} className="space-y-4">
            <H3 id={item.id}>{item.title}</H3>
            <P>{item.description}</P>
            <SeamPlayer {...item.props} />
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                Show code
              </summary>
              <div className="mt-3">
                <CodeBlock
                  label={`${item.title} example`}
                  javascriptCode={generateExample(
                    item.props,
                    { controls: false, events: false },
                    "javascript"
                  )}
                >
                  {generateExample(item.props, {
                    controls: false,
                    events: false,
                  })}
                </CodeBlock>
              </div>
            </details>
          </div>
        ))}
      </Section>
      <Section id="add-yours" title="Add yours">
        <P>
          Using Seamplayer in production? Open a pull request on{" "}
          <DocLink href="https://github.com/ARITRA69/seamlift-opensource">
            GitHub
          </DocLink>{" "}
          to add it here.
        </P>
      </Section>
    </DocsPage>
  );
}
