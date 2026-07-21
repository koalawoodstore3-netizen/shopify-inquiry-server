const express = require('express');
const multer = require('multer');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // Limit pliku np. 10MB

// Konfiguracja Resend (darmowe API do wysyłki e-maili z załącznikami)
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.post('/api/inquiry', upload.single('logo'), async (req, res) => {
  try {
    const { email, ilosc, Produkt } = req.body;
    const file = req.file;

    if (!email || !ilosc || !file) {
      return res.status(400).send('Brak wymaganych pól lub pliku.');
    }

    // Wysyłka maila do Ciebie za pomocą Resend
    const data = await resend.emails.send({
      from: 'Sklep <onboarding@resend.dev>', // W przyszłości możesz tu podpiąć swoją domenę
      to: ['koalawoodstore@gmail.com'],
      subject: `Nowe zapytanie o produkt z logo: ${Produkt}`,
      html: `
        <h2>Nowe zapytanie z formularza produktu</h2>
        <p><strong>Produkt:</strong> ${Produkt}</p>
        <p><strong>E-mail klienta:</strong> ${email}</p>
        <p><strong>Ilość sztuk:</strong> ${ilosc}</p>
        <p>W załączniku znajduje się plik z logo przesłany przez klienta.</p>
      `,
      attachments: [
        {
          filename: file.originalname,
          content: file.buffer,
        },
      ],
    });

    // Po udanej wysyłce przekieruj klienta z powrotem do sklepu (np. na stronę podziękowania)
    res.redirect('https://twoj-sklep.pl/pages/dziekujemy'); // Podmień na swój adres
  } catch (error) {
    console.error(error);
    res.status(500).send('Wystąpił błąd podczas wysyłania wiadomości.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
