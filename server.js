const express = require('express');
const multer = require('multer');
const { Resend } = require('resend');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Konfiguracja folderu tymczasowego na pliki
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
    const { email, ilosc, Produkt, firma_imie, kategoria } = req.body;
    const file = req.file;

    // Walidacja najważniejszych pól wymaganych
    if (!email || !ilosc || !firma_imie || !Produkt) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).send('Brak wymaganych pól.');
    }

    if (file) {
      filePath = file.path;
    }

    const fileBuffer = filePath ? fs.readFileSync(filePath) : null;
    const attachments = fileBuffer ? [{ filename: file.originalname, content: fileBuffer }] : [];

    // Słownik ładnych nazw dla wszystkich znanych pól z formularza
    const fieldLabels = {
      email: 'E-mail klienta',
      ilosc: 'Potrzebna ilość',
      Produkt: 'Wybrany produkt',
      firma_imie: 'Firma / Imię',
      dodatkowe_informacje: 'Dodatkowe informacje',
      logo_opcja: 'Własne logo',
      opcja_boczna: 'Opcja boczna',
      nadruk_klawisze: 'Nadruk na klawisze',
      glosnosc_przelacznikow: 'Głośność przełączników',
      glosnosc_suwaka: 'Głośność suwaka',
      sposob_montazu: 'Sposób montażu',
      szacowana_cena_jednostkowa: 'Szacowana wartość netto za sztukę',
      szacowana_cena: 'Szacowana wartość netto ogółem'
    };

    // Sprawdzenie kategorii w sposób niezależny od języka + zabezpieczenie po obecności pola głośności suwaka
    const categoryValue = (kategoria || '').toLowerCase();
    const isSlider = categoryValue.includes('slider') || categoryValue.includes('suwak') || Boolean(req.body.glosnosc_suwaka);

    // Dynamiczne generowanie HTML dla wszystkich pól przesłanych w formularzu
    let dynamicFieldsHtml = '';
    for (const [key, value] of Object.entries(req.body)) {
      if (value !== undefined && value !== null && value !== '' && key !== 'kategoria') {
        // Jeśli to suwak, pomiń głośność przełączników; jeśli kliker, pomiń głośność suwaka
        if (isSlider && key === 'glosnosc_przelacznikow') continue;
        if (!isSlider && key === 'glosnosc_suwaka') continue;

        const label = fieldLabels[key] || key;
        dynamicFieldsHtml += `<p><strong>${label}:</strong> ${value}</p>`;
      }
    }

    // Wysyłka maila za pomocą Resend zawierającego pełną specyfikację
    const data = await resend.emails.send({
      from: 'Sklep <info@koala-wood.com>',
      to: ['info@koala-wood.com'],
    reply_to: email,
      replyTo: email, // Ustawia adres e-mail klienta jako docelowy przy odpowiedzi
      subject: `Nowa wycena / zamówienie: ${Produkt} (${firma_imie})`,
      html: `
        <h2>Nowe zapytanie z zaawansowanego kalkulatora</h2>
        ${dynamicFieldsHtml}
        <hr/>
        <p>${file ? 'W załączniku znajduje się plik graficzny z logo przesłany przez klienta.' : 'Klient nie dołączał pliku z logo.'}</p>
      `,
      attachments: attachments,
    });

    res.status(200).send('Wysłano pomyślnie');

  } catch (error) {
    console.error('Błąd podczas wysyłania:', error);
    res.status(500).send('Wystąpił błąd podczas wysyłania wiadomości.');
  } finally {
    // Czyszczenie pliku tymczasowego
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
