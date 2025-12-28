export default async function handler(req, res) {
  const { page } = req.query;

  const r = await fetch(
    `https://api.pixeora.com/sitemap-images-${page}.xml`
  );
  const xml = await r.text();

  res.setHeader("Content-Type", "application/xml");
  res.status(200).send(xml);
}
