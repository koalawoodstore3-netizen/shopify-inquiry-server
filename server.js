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
    // Odbieramy wszystkie pola przesłane przez nowy formularz kalkulatora
    const { 
      email, 
      ilosc, 
      Produkt, 
      firma_imie, 
      dodatkowe_informacje, 
      logo_opcja, 
      opcja_boczna, 
      nadruk_klawisze, 
      szacowana_cena 
    } = req.body;
    
    const file = req.file;

    // Walidacja podstawowych pól
    if (!email || !ilosc || !firma_imie || !Produkt) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).send('Brak wymaganych pól.');
    }

    // Jeśli klient wybrał opcję z logo, plik staje się wymagany na serwerze
    if (logo_opcja === 'tak' && !file) {
      return res.status(400).send('Wymagany plik z logo.');
    }

    if (file) {
      filePath = file.path;
    }

    const fileBuffer = filePath ? fs.readFileSync(filePath) : null;
    const attachments = fileBuffer ? [{ filename: file.originalname, content: fileBuffer }] : [];

    // Wysyłka maila za pomocą Resend zawierającego pełną specyfikację zamówienia
    const data = await resend.emails.send({
      from: 'Sklep <onboarding@resend.dev>',
      to: ['koalawoodstore@gmail.com'],
      replyTo: email, // <--- TUTAJ DODANO: Ustawia adres e-mail klienta jako docelowy przy odpowiedzi
      subject: `Nowa wycena / zamówienie: ${Produkt} (${firma_imie})`,
      html: `
        <h2>Nowe zapytanie z zaawansowanego kalkulatora</h2>
        <p><strong>Wybrany produkt:</strong> ${Produkt}</p>
        <p><strong>Firma / Imię:</strong> ${firma_imie}</p>
        <p><strong>E-mail klienta:</strong> ${email}</p>
        <p><strong>Potrzebna ilość:</strong> ${ilosc} szt.</p>
        <hr/>
        <h3>Szczegóły konfiguracji:</h3>
        <p><strong>Własne logo:</strong> ${logo_opcja === 'tak' ? 'Tak (+1.50 zł/szt.)' : 'Nie'}</p>
        <p><strong>Opcja boczna (symbol/tekst):</strong> ${opcja_boczna === 'wypukly' ? 'Wypukły' : opcja_boczna === 'wklesly' ? 'Wklęsły' : 'Brak'}</p>
        <p><strong>Nadruk na klawisze:</strong> ${nadruk_klawisze === 'tak' ? 'Tak' : 'Nie'}</p>
        <p><strong>Szacowana wartość netto ogółem:</strong> ${szacowana_cena || 'Brak'}</p>
        <p><strong>Dodatkowe informacje od klienta:</strong> ${dodatkowe_informacje || 'Brak'}</p>
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
