export const metadata = {
  title: "Etiquetas ME1 · Buenos Aires",
  description: "Generación de etiquetas PDF (3 por A4) para envíos ME1 en Provincia de Buenos Aires",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#f7f7f8" }}>{children}</body>
    </html>
  );
}
