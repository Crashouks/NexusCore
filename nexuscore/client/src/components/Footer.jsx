export default function Footer() {
  return (
    <footer className="site-footer">
      <p>© {new Date().getFullYear()} NexusCore. Own it. Try it. Stream it.</p>
      <p style={{ marginTop: 8, fontSize: 12 }}>Powered by GeForce Now · Free trials on select titles</p>
    </footer>
  );
}
