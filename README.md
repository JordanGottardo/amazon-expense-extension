
**Amazon, quanto mi costi?** è un'estensione per Google Chrome che permette di calcolare e visualizzare lo storico di spese/resi su Amazon.it (al momento solamente il dominio .it è supportato).

# Installazione
## Opzione A: installazione tramite Web store (TODO)
## Opzione B: installazione manuale
1. Clonare/scaricare il repository 
2. Aprire Chrome
3. Navigare all'URL _chrome://extensions/_ e abilitare la _modalità sviluppatore_ (spunta in alto a destra) ![chrome_5muDlvBTWg](https://user-images.githubusercontent.com/15140122/116894961-f2fde580-ac32-11eb-9b5f-cecf9657e836.png)
4. Fare click su _Carica estensione non pacchettizzata_ ![image](https://user-images.githubusercontent.com/15140122/116895147-2b9dbf00-ac33-11eb-8bf6-742635ab4367.png)
5. Selezionare la directory _Extension_ contenente il codice dell'estensione
6. Una volta caricata, è possibile accedere all'applicazione tramite l'icona delle Estensioni di Chrome ed è possibile pinnarla per un più facile accesso 
 ![image](https://user-images.githubusercontent.com/15140122/116896300-67855400-ac34-11eb-95ff-d0895181d9bd.png)
 
# Funzionamento
## Prerequisiti
Per un corretto funzionamento, è consigliabile effettuare il login su Amazon.it da Chrome selezionando la voce "remember me"
## Avvio
Al primo avvio, l'estensione non ha dati da mostrare, e suggerisce l'avvio del calcolo tramite il pulsante "Calcola spese"

Facendo click su quel pulsante, l'estensione comincia a calcolare tutte le spese effettuate dal vostro account Amazon.it

**ATTENZIONE!** Durante il calcolo delle spese, l'estensione aprirà e chiuderà in automatico varie schede dei vostri ordini su Amazon.it. Per garantire la correttezza del calcolo, è **FONDAMENTALE** non interferire con questo processo, evitando di interagire con le schede aperte, e con Google Chrome in generale. 
L'operazione potrebbe durare 10 o più minuti (dipendentemente dal numero di ordini che avete effettuato). Durante il calcolo non vengono collezionati dati personali, ma soltanto i valori degli ordini per il calcolo del totale della spesa.

Una volta terminato il calcolo, l'estensione visualizza all'interno della scheda un grafico riassuntivo. Qui un esempio con dati casuali
![image](https://user-images.githubusercontent.com/15140122/116900320-e7adb880-ac38-11eb-9175-8b2d633f814b.png)

## Interpretazione dei risultati
Il grafico riporta sull'asse X gli anni e sull'asse Y l'importo di spese/rimborsi. 
* **Spesa tot.**: indica la spesa annuale al netto di sconti e rimborsi. Ad esempio, se avete acquistato un articolo a 100€ e poi ne avete effettuato il reso, quell'articolo non verrà conteggiato nalla voce di Spesa. Pertanto, questa voce indica la spesa **netta** annuale.
* **Rimborso**: indica il valore rimborsato da Amazon a causa di resi da voi effettuati. Può assumere un valore più alto rispetto al campo Spesa tot. nel (raro) caso in cui abbiate effettuato resi per un valore maggiore rispetto a quanto speso all'interno di un singolo anno.
