# Projektinfo

### Vercel-länk
https://petalhaus-v2.vercel.app/

### Kör projektet lokalt
1. I roten: `vercel dev`
2. `cd frontend`
3. `vercel dev`

<br>

<br>

# Labb 1
### Angående mappning av produktdata
**Artikelnummer** - Finns ej med i min datamodell. Jag använder ett id med increment och anser inte att jag behöver ytterligare ett id. Jag använder istället EAN för att kontrollera huruvida en produkt existerar i sortimentet eller ej.

**EAN** - Fanns ej med i min datamodell. Jag skapade en ny kolumn för att implementera denna labb.

**Lagersaldo** - Fanns ej med i min datamodell. Jag skapade en ny kolumn för att implementera Labb 3.

**Varianter** - Finns ej med i min datamodell. Jag anser att jag inte behöver den i nuläget.

**Uppdaterad** - Fanns ej med i min datamodell. Jag skapade en ny kolumn för att kontrollera dataversioner, men jag beslutade efter många om och men att trots allt inte kontrollera datumet i upsert-logiken.