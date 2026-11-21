GROUPS = [
 ("commissions", "Commissions & queue", [
   ("commissionsOpen","Commissions open","Turn off to show the waitlist instead"),
   ("slotsTotal","Slots this month",""),
   ("slotsTaken","Slots taken",""),
   ("queueText","Commission queue","One order per line:  Name | Piece | Stage.  Stage = Queued, Sketching, Line art, Colouring, Final touches (or 1–5)"),
 ]),
 ("prices", "Commission prices (USD)", [
   ("priceChibi","The Chibi",""),("priceIllustration","The Illustrator",""),("pricePoster","The Poster",""),("priceDesignSheet","The Designer (design + sheets)",""),
   ("priceHalfBody","Half body add-on",""),("priceFullBody","Full body add-on",""),
   ("priceBgSimple","Simple background",""),("priceBgDetailed","Detailed scene",""),
   ("extraCharPct","Each extra character (% of price)",""),("commercialPct","Commercial use (% extra)",""),
 ]),
 ("addons", "Add-on features (USD)", [
   ("addComplex","Complex design details",""),("addExpression","Extra expression",""),("addOutfit","Extra outfit",""),("addRush","Rush / urgent (% of total)",""),
 ]),
 ("shop", "Print shop & shipping", [
   ("printA5","A5 print (USD)",""),("printA4","A4 print (USD)",""),("printA3","A3 print (USD)",""),
   ("shipMalaysiaRM","Shipping in Malaysia (RM)",""),("shipOverseasUSD","Shipping overseas (USD)",""),
   ("merchComingSoon","Siginnas merch: show 'Coming soon'",""),
   ("discountTestMode","Discount dial test mode","Keep OFF on the live site — when ON, visitors can spin unlimited times"),
 ]),
 ("payment", "Payment details", [
   ("bankDetails","Bank transfer (DuitNow / CIMB) details",""),("tngDetails","Touch 'n Go details",""),
   ("wiseLink","Wise payment link",""),("proofFormLink","Request / proof-of-payment Google Form link",""),
   ("stripeEnabled","Show card payment (Stripe)",""),("stripeLink","Stripe payment link",""),("tngLink","Touch 'n Go link (optional)",""),
 ]),
 ("currency", "Currencies", [
   ("rateMYR","1 USD in MYR",""),("rateEUR","1 USD in EUR",""),("rateGBP","1 USD in GBP",""),("rateSGD","1 USD in SGD",""),("rateAUD","1 USD in AUD",""),("rateJPY","1 USD in JPY",""),
   ("adjMYR","Regional price factor — MYR","1 = full US price, 0.49 = 49% of it"),("adjEUR","Regional price factor — EUR",""),("adjGBP","Regional price factor — GBP",""),
   ("adjSGD","Regional price factor — SGD",""),("adjAUD","Regional price factor — AUD",""),("adjJPY","Regional price factor — JPY",""),
 ]),
 ("look", "Look & links", [
   ("accent","Accent colour",""),("portfolioLink","Portfolio link (optional)",""),("swipeEnabled","Allow swiping the artwork carousel",""),
 ]),
]
MULTILINE = {"queueText","bankDetails","tngDetails"}
