/* Accesso e archivio online. Nessun dato studenti è scritto in localStorage. */
'use strict';
window.PortalCloud={
 user:null,etag:null,ready:false,auth:null,sdk:null,config:null,
 async start(onUser){
  this.config=window.PORTAL_CONFIG;
  const f=this.config?.firebase;
  if(!f||!['apiKey','authDomain','databaseURL','projectId','appId'].every(k=>typeof f[k]==='string'&&f[k].trim()))throw Error('Compila firebase-config.js con i valori del nuovo progetto. Segui la guida inclusa.');
  if(!/^https:\/\/[^/]+\.(firebasedatabase\.app|firebaseio\.com)\/?$/.test(f.databaseURL))throw Error('databaseURL deve essere l’indirizzo HTTPS del Realtime Database, senza percorsi aggiuntivi.');
  if(location.protocol==='file:')throw Error('Questa versione online si apre dal link GitHub Pages. Il doppio clic sul file non consente l’accesso Google.');
  const [app,sdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js')]);
  this.sdk=sdk;this.auth=sdk.getAuth(app.initializeApp(f));
  await sdk.setPersistence(this.auth,sdk.browserSessionPersistence);
  sdk.onAuthStateChanged(this.auth,user=>{this.user=user;this.etag=null;this.ready=false;onUser(user)});
 },
 async login(){const provider=new this.sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await this.sdk.signInWithPopup(this.auth,provider)},
 async logout(){await this.sdk.signOut(this.auth)},
 async request(method,body,etag){
  const user=this.user;
  if(!user||user.uid!==this.config.ownerUid||!user.emailVerified)throw Error('Account non autorizzato.');
  const token=await user.getIdToken();
  const url=this.config.firebase.databaseURL.replace(/\/$/,'')+'/registri/'+encodeURIComponent(user.uid)+'.json?auth='+encodeURIComponent(token);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const response=await fetch(url,{method,signal:controller.signal,cache:'no-store',headers:{'Content-Type':'application/json','X-Firebase-ETag':'true',...(etag?{'if-match':etag}:{})},...(body?{body:JSON.stringify(body)}:{})});
   if(!response.ok){const e=Error(response.status===412?'Il registro è cambiato su un altro dispositivo. Chiudi il modulo, aggiorna dal cloud e ripeti la modifica.':response.status===401||response.status===403?'Accesso al database negato: controlla UID e regole Firebase.':'Il servizio ha risposto con errore '+response.status+'.');e.status=response.status;throw e}
   const value=await response.json();if(this.user!==user)throw Error('La sessione è cambiata. Ricarica la pagina.');return{value,etag:response.headers.get('ETag')};
  }finally{clearTimeout(timer)}
 },
 async read(){return this.request('GET')},
 async write(data){
  if(!this.ready||!this.etag)throw Error('Apri prima l’archivio online con “Aggiorna dal cloud”.');
  if(!navigator.onLine)throw Error('Sei offline. La modifica non è salvata: riconnettiti e riprova.');
  const record={revision:crypto.randomUUID(),data:JSON.stringify(data)};
  try{const result=await this.request('PUT',record,this.etag);this.etag=result.etag;return record.revision}
  catch(e){if(e.status)throw e;
   // Una risposta persa non implica necessariamente che il server non abbia salvato.
   try{const check=await this.read();if(check.value?.revision===record.revision){this.etag=check.etag;return record.revision}}catch{}
   throw Error('Salvataggio non confermato. Il modulo resta disponibile. Verifica la connessione e aggiorna dal cloud prima di riprovare.');
  }
 },
 friendly(e){return ({'auth/popup-blocked':'Consenti la finestra di accesso Google e riprova.','auth/popup-closed-by-user':'Accesso annullato. Puoi riprovare.','auth/unauthorized-domain':'Aggiungi il dominio GitHub Pages tra i domini autorizzati di Firebase Authentication.'})[e.code]||e.message||'Operazione non riuscita.'}
};
