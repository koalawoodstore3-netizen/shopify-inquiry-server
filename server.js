const express = require('express');
const multer = require('multer');
const { Resend } = require('resend');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Konfiguracja folderu tymczasowego na pliki (zapobiega zapychanju pamięci RAM)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // Limit 10MB
});

// Konfiguracja Resend
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/api/inquiry', upload.single('logo'), async (req, res) => {
  let filePath = null;

  try {
    const { email, ilosc, Produkt, firma_imie } = req.body;
    const file = req.file;

    if (!email || !ilosc || !file || !firma_imie) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).send('Brak wymaganych pól lub pliku.');
    }

    filePath = file.path;

    // Wysyłka maila do Ciebie za pomocą Resend z użyciem ścieżki do pliku z dysku
    const data = await resend.emails.send({
      from: 'Sklep <onboarding@resend.dev>',
      to: ['koalawoodstore@gmail.com'],
      subject: `Nowe zapytanie: ${Produkt} (${firma_imie})`,
      html: `
        <h2>Nowe zapytanie o wycenę z logo</h2>
        <p><strong>Produkt:</strong> ${Produkt}</p>
        <p><strong>Firma / Imię:</strong> ${firma_imie}</p>
        <p><strong>E-mail klienta:</strong> ${email}</p>
        <p><strong>Ilość sztuk:</strong> ${ilosc}</p>
        <p>W załączniku znajduje się plik z logo przesłany przez klienta.</p>
      `,
      attachments: [
        {
          filename: file.originalname,
          path: filePath,
        },
      ],
    });

    res.status(200).send('Wysłano pomyślnie');

  } catch (error) {
    console.error('Błąd podczas wysyłania:', error);
    res.status(500).send('Wystąpił błąd podczas wysyłania wiadomości.');
  } finally {
    // BEZWZGLĘDNE USUWANIE PLIKU Z DYKU PO WYSŁANIU (lub w razie błędu)
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error('Nie udało się usunąć pliku tymczasowego:', unlinkErr);
      }
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
