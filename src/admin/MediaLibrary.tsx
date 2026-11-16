import HandBox from "../components/HandBox";

export default function MediaLibrary() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Media</h1>
      </div>
      <section className="box editor">
        <HandBox seed="media-help" fill amp={2} />
        <h2>How images work</h2>
        <p>Images are stored as files in the Git repository, not in a database or cloud bucket.</p>
        <ol style={{ lineHeight: 1.8 }}>
          <li>Put your image files in <code>public/media/</code> in the project folder.</li>
          <li>Commit and push to GitHub, then redeploy.</li>
          <li>In the project editor or site settings, type the <strong>filename</strong> (e.g. <code>robot.png</code>) or a <strong>full URL</strong>.</li>
        </ol>
        <h3>Supported formats</h3>
        <p>PNG, JPEG, WebP, GIF, ICO, SVG.</p>
        <h3>Using external URLs</h3>
        <p>You can also paste a full URL to any image hosted elsewhere (e.g. GitHub raw URL, Imgur, etc.). Just paste the full <code>https://…</code> link in the image field.</p>
        <h3>Tips</h3>
        <ul style={{ lineHeight: 1.8 }}>
          <li>Use short, descriptive filenames: <code>robot-cover.png</code>, <code>portfolio-logo.png</code></li>
          <li>Keep images reasonably sized — compress before adding if they're large.</li>
          <li>Cover images look best at 16:10 aspect ratio.</li>
        </ul>
      </section>
    </>
  );
}
