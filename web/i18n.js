// Cambio de idioma EN/ES. La interfaz se escribe en inglés; este módulo traduce al español
// los textos visibles (y placeholder/aria-label/title) cada vez que cambian, sin tocar la lógica.

const ES = {
  "The Holdfast torii: a gate held up by its ember beam": "El torii de Holdfast: una puerta sostenida por su viga brasa", "Your money.": "Tu dinero.", "Their work.": "Su trabajo.", "Goal missed? You get 100% back.": "¿No llegan a la meta? Recuperas el 100%.",
  "Scroll to bring them together": "Desliza para unirlas", "For creators": "Para creadores", "Language": "Idioma",
  "Projects": "Proyectos", "Launch": "Lanzar", "Portfolio": "Portafolio", "Owner": "Dueño",
  "Connect wallet": "Conectar wallet", "Sepolia testnet": "Sepolia (prueba)",
  "Holdfast never holds your money. Every project has its own contract with no admin.": "Holdfast nunca guarda tu dinero. Cada proyecto tiene su propio contrato sin administrador.",
  "Open source": "Código abierto",
  "Hold fast to what you back.": "Sostén firme lo que apoyas.",
  "Back early-stage projects with USDC. Your money stays locked in a contract no one owns, and the team gets paid in stages, only when backers vote yes.":
    "Apoya proyectos en etapa temprana con USDC. Tu dinero queda bloqueado en un contrato sin dueño, y el equipo cobra por etapas, solo cuando los inversores votan que sí.",
  "Browse projects": "Ver proyectos", "Launch a project": "Lanzar un proyecto",
  "Raised on Holdfast": "Recaudado en Holdfast", "Projects funded": "Proyectos financiados", "Open raises": "Rondas abiertas",
  "How it works": "Cómo funciona", "Back a project": "Apoya un proyecto",
  "Your USDC goes into that project's own contract. If it's the first backing, your transaction creates the contract for a few cents.":
    "Tus USDC entran al contrato propio de ese proyecto. Si eres el primero, tu transacción crea el contrato por unos centavos.",
  "Vote on every release": "Vota cada entrega",
  "The team gets a small part when the raise closes and the rest in stages. Each stage is paid only if backers approve it.":
    "El equipo recibe una parte pequeña al cerrar la ronda y el resto por etapas. Cada etapa se paga solo si los inversores la aprueban.",
  "Get it back if it fails": "Recupéralo si fracasa",
  "If the goal isn't met, you get 100% back. If the team disappears or loses a vote, what's left returns to backers.":
    "Si no se llega a la meta, recuperas el 100%. Si el equipo desaparece o pierde una votación, lo que queda vuelve a los inversores.",
  "Featured projects": "Proyectos destacados", "No projects are live yet.": "Todavía no hay proyectos publicados.", "Launch the first one": "Lanza el primero",
  "Open": "Abierto", "Funded": "Financiado", "Completed": "Completado", "Refunding": "Devolviendo fondos", "Raise closed": "Ronda cerrada",
  "All projects": "Todos los proyectos", "About": "De qué se trata", "How your money is protected": "Cómo se protege tu dinero",
  "Goal missed, full refund": "Si no hay meta, se devuelve todo", "The team is paid in stages": "El equipo cobra por etapas", "No one can touch it": "Nadie puede tocarlo",
  "The contract has no admin. If the team vanishes or loses a vote, the rest goes back to backers.": "El contrato no tiene administrador. Si el equipo desaparece o pierde una votación, el resto vuelve a los inversores.",
  "Releases": "Entregas", "Team updates": "Avances del equipo", "No updates yet.": "Todavía no hay avances.", "Contract": "Contrato",
  "Address": "Dirección", "Status": "Estado", "Live on-chain": "Activo en la blockchain", "Created by the first backing": "Se crea con la primera inversión",
  "Team wallet": "Wallet del equipo", "Holdfast fee": "Comisión de Holdfast", "1% of funds + 1.5% of tokens, only if funded": "1% del dinero + 1,5% de los tokens, solo si se financia",
  "Network": "Red", "Upfront": "Inicial", "When the raise closes successfully": "Al cerrar la ronda con éxito", "Approved by backers": "Aprobada por los inversores",
  "Pending": "Pendiente", "Cancelled, funds returned to backers": "Cancelada, fondos devueltos a los inversores",
  "Amount to back": "Monto a invertir", "Max": "Máx.", "Back this project": "Apoyar este proyecto", "Connect wallet to back": "Conecta tu wallet para invertir",
  "You're early: your backing also creates this project's contract. It costs a few extra cents of gas, once.": "Eres de los primeros: tu inversión también crea el contrato del proyecto. Cuesta unos centavos extra de gas, una sola vez.",
  "Close the raise": "Cerrar la ronda", "The raise has ended. Anyone can close it to release tokens or refunds.": "La ronda terminó. Cualquiera puede cerrarla para liberar tokens o reembolsos.",
  "The raise ended with no backers.": "La ronda terminó sin inversores.",
  "Backers rejected a release or the team missed a deadline.": "Los inversores rechazaron una entrega o el equipo no cumplió un plazo.",
  "The minimum goal wasn't reached.": "No se alcanzó la meta mínima.", "What's left is being returned to backers.": "Lo que queda se devuelve a los inversores.",
  "Funded. The team is paid in stages that backers approve.": "Financiado. El equipo cobra por etapas que aprueban los inversores.",
  "Price": "Precio", "Minimum goal": "Meta mínima", "Maximum goal": "Meta máxima", "Closes": "Cierra",
  "Most you could lose today": "Lo máximo que podrías perder hoy", "Fully protected until the raise closes.": "Protegido al 100% hasta que cierre la ronda.",
  "Claim my tokens": "Recibir mis tokens", "Get my money back": "Recuperar mi dinero", "Your position": "Tu posición", "You put in": "Pusiste",
  "Your tokens": "Tus tokens", "Tokens to claim": "Tokens por recibir", "Refund": "Reembolso", "Withdrawn": "Retirado",
  "Release vote": "Votación de entregas", "Voting has ended.": "La votación terminó.", "Approve": "Aprobar", "Reject": "Rechazar",
  "You've voted on this release.": "Ya votaste en esta entrega.", "Apply the result": "Aplicar el resultado",
  "The team missed the deadline. Anyone can cancel the project and return what's left.": "El equipo no cumplió el plazo. Cualquiera puede cancelar el proyecto y devolver lo que queda.",
  "Cancel and refund backers": "Cancelar y devolver el dinero",
  "Connect your wallet. It's the wallet that receives the funds and signs your project.": "Conecta tu wallet. Es la que recibe el dinero y firma tu proyecto.",
  "Fill in the details and sign them with your wallet. Holdfast reviews every project before it goes live. Signing is free.":
    "Completa los datos y fírmalos con tu wallet. Holdfast revisa cada proyecto antes de publicarlo. Firmar es gratis.",
  "The project": "El proyecto", "Name": "Nombre", "Ticker": "Símbolo", "Category": "Categoría", "One-line summary": "Resumen en una frase",
  "What you do and who it's for": "Qué haces y para quién", "Description": "Descripción",
  "What the money is for, the timeline, and how backers will see progress.": "Para qué es el dinero, los plazos y cómo verán el avance los inversores.",
  "40 to 2,000 characters.": "Entre 40 y 2.000 caracteres.", "Colour": "Color", "The money": "El dinero",
  "Minimum goal (USDC)": "Meta mínima (USDC)", "Below this, everyone is refunded.": "Si no se llega, se devuelve todo.", "Maximum goal (USDC)": "Meta máxima (USDC)",
  "Raise length": "Duración de la ronda", "Tokens for backers": "Tokens para inversores", "Tokens for your team": "Tokens para tu equipo",
  "Unlocked with each release.": "Se liberan con cada entrega.", "Upfront when the raise closes": "Inicial al cerrar la ronda",
  "Number of voted releases": "Cantidad de entregas votadas", "Window to request each release": "Plazo para pedir cada entrega",
  "Miss it and the remaining funds go back to backers.": "Si no la pides a tiempo, el dinero restante vuelve a los inversores.",
  "Sign and submit for review": "Firmar y enviar a revisión", "How backers will see it": "Así lo verán los inversores", "Your project": "Tu proyecto",
  "Your summary shows here": "Tu resumen aparece aquí", "Goal": "Meta", "You get at close": "Recibes al cerrar", "Then": "Después",
  "Connect your wallet to see what you've backed and what you've launched.": "Conecta tu wallet para ver lo que apoyaste y lo que lanzaste.",
  "Everything you've backed, how much is still protected, and the projects you've launched.": "Todo lo que apoyaste, cuánto sigue protegido y los proyectos que lanzaste.",
  "Total backed": "Total invertido", "Projects backed": "Proyectos apoyados", "Projects launched": "Proyectos lanzados", "USDC in wallet": "USDC en tu wallet",
  "Backed": "Apoyados", "Put in": "Pusiste", "Tokens": "Tokens", "Most you could lose": "Lo máximo que podrías perder",
  "You haven't backed anything yet.": "Todavía no apoyaste ningún proyecto.", "Launched": "Lanzados",
  "In review": "En revisión", "Live": "Publicado", "Not approved": "No aprobado", "Open project and releases": "Ver proyecto y entregas",
  "Post an update": "Publicar un avance", "What you've done since the last update, with links.": "Qué hiciste desde el último avance, con enlaces.",
  "Sign and post": "Firmar y publicar", "Holdfast is reviewing your project. It goes live once approved.": "Holdfast está revisando tu proyecto. Se publica cuando lo aprueben.",
  "Your project wasn't approved. You can fix it and submit again.": "Tu proyecto no fue aprobado. Puedes corregirlo y enviarlo de nuevo.",
  "You haven't launched a project.": "Todavía no lanzaste ningún proyecto.", "Launch one": "Lanza uno",
  "Only the platform wallet can open this panel.": "Solo la wallet de la plataforma puede abrir este panel.",
  "Your fees, platform activity and the projects waiting for your approval.": "Tus comisiones, la actividad de la plataforma y los proyectos que esperan tu aprobación.",
  "Fees earned in USDC": "Comisiones en USDC", "Awaiting review": "Esperan revisión", "Fees by project": "Comisiones por proyecto", "Project": "Proyecto",
  "No project has been funded yet. Fees reach your wallet the moment one closes successfully.": "Todavía no se financió ningún proyecto. Las comisiones llegan a tu wallet en cuanto uno cierre con éxito.",
  "Sign to see the AI review of each project. Signing is free.": "Firma para ver la revisión de la IA de cada proyecto. Firmar es gratis.",
  "Sign and show reviews": "Firmar y ver revisiones", "Nothing is waiting.": "No hay nada esperando.", "No AI review.": "Sin revisión de IA.",
  "Low risk": "Riesgo bajo", "Medium risk": "Riesgo medio", "High risk": "Riesgo alto", "Signals": "Señales", "Questions for the creator": "Preguntas para el creador",
  "Description and numbers": "Descripción y números", "Team tokens": "Tokens del equipo", "Approve and publish": "Aprobar y publicar",
  "Confirm each step in your wallet.": "Confirma cada paso en tu wallet.", "Waiting for your confirmation": "Esperando tu confirmación",
  "Processing on-chain": "Procesando en la blockchain", "Done": "Listo", "Allow your USDC": "Autorizar tus USDC", "Create the project contract": "Crear el contrato del proyecto",
  "Close the raise: done": "Cerrar la ronda: listo", "Submit project": "Enviar proyecto", "Sign the project with your wallet": "Firmar el proyecto con tu wallet",
  "Send for review": "Enviar a revisión", "Submitted for review": "Enviado a revisión", "Approve project": "Aprobar proyecto", "Reject project": "Rechazar proyecto",
  "Sign your decision": "Firmar tu decisión", "Save": "Guardar", "Published": "Publicado", "Rejected": "Rechazado", "Show reviews": "Ver revisiones",
  "Sign to identify yourself": "Firmar para identificarte", "Reviews unlocked": "Revisiones abiertas", "Post update": "Publicar avance",
  "Sign the update": "Firmar el avance", "Post": "Publicar", "Update posted": "Avance publicado", "Approve release": "Aprobar entrega", "Reject release": "Rechazar entrega",
  "Request release": "Pedir entrega", "Connect your wallet first.": "Conecta tu wallet primero.", "Enter how much you want to back.": "Escribe cuánto quieres invertir.",
  "Write at least 10 characters.": "Escribe al menos 10 caracteres.", "No wallet found. Install Phantom, MetaMask or Coinbase Wallet.": "No encontramos una wallet. Instala Phantom, MetaMask o Coinbase Wallet.",
  "The network rejected the transaction.": "La red rechazó la transacción.", "The server didn't respond.": "El servidor no respondió.",
  "Local business": "Comercio local", "Technology": "Tecnología", "Environment": "Medio ambiente", "Education": "Educación", "Arts & culture": "Arte y cultura",
  "Health": "Salud", "Food & drink": "Comida y bebida", "Other": "Otro", "Live numbers": "Cifras en vivo", "Live activity": "Actividad en vivo", "Live now": "En vivo", "Common": "Común", "Rare": "Rara", "Epic": "Épica", "Legendary": "Legendaria", "Raised": "Recaudado", "Team": "Equipo", "Q&A": "Preguntas", "Simulate your backing": "Simula tu inversión", "Team stops after release 1": "Si el equipo se detiene tras la entrega 1", "Every release approved": "Todas las entregas aprobadas", "You keep all your tokens": "Conservas todos tus tokens", "Team details are provided and signed by the creator. Holdfast reviews them before approval.": "Los datos del equipo los escribe y firma el creador. Holdfast los revisa antes de aprobar.", "The team hasn't added profiles yet.": "El equipo todavía no agregó perfiles.", "Read live from the blockchain.": "Leído en vivo de la blockchain.", "No backers yet. Be the first: your backing also creates the contract.": "Todavía no hay inversores. Sé el primero: tu inversión también crea el contrato.", "Ask the team anything about this project": "Pregúntale al equipo lo que quieras sobre el proyecto", "Sign and ask": "Firmar y preguntar", "Connect your wallet to ask a question.": "Conecta tu wallet para hacer una pregunta.", "No questions yet.": "Todavía no hay preguntas.", "Backer": "Inversor", "Creator": "Creador", "Waiting for the creator's answer.": "Esperando la respuesta del creador.", "Write your answer": "Escribe tu respuesta", "Sign and answer": "Firmar y responder", "Get my backer card": "Mi carta de inversor", "Your backer card": "Tu carta de inversor", "Save it or share it. It shows your backing, not a financial instrument.": "Guárdala o compártela. Muestra tu apoyo; no es un instrumento financiero.", "Download": "Descargar", "Share": "Compartir", "Close": "Cerrar", "Goal reached": "Meta alcanzada", "Your team": "Tu equipo", "Backers trust teams they can see. Add up to 4 people with a public link (X, GitHub, LinkedIn or a website).": "Los inversores confían en equipos que pueden ver. Agrega hasta 4 personas con un enlace público (X, GitHub, LinkedIn o una web).", "Add team member": "Agregar persona", "Role": "Rol", "Ask a question": "Hacer una pregunta", "Answer": "Responder", "Sign with your wallet": "Firmar con tu wallet", "Question posted": "Pregunta publicada", "Answer posted": "Respuesta publicada", "Write at least 5 characters.": "Escribe al menos 5 caracteres.", "Investment simulator": "Simulador de inversión", "Amount to simulate": "Monto a simular", "Overview": "Resumen", "Protection": "Protección", "Updates": "Avances", "Backers": "Inversores", "Backers this week": "Inversores esta semana", "Back now": "Invertir", "Enter an amount": "Escribe un monto", "Key numbers": "Cifras clave", "Project sections": "Secciones del proyecto", "Amount": "Monto", "You receive": "Recibes", "If the goal is missed": "Si no llegan a la meta", "100% back": "Recuperas el 100%", "Network fee": "Costo de red", "Less than $0.01": "Menos de $0,01", "A few cents, once": "Unos centavos, una vez", "Your balance": "Tu saldo", "You're early: your backing also creates this project's contract.": "Eres de los primeros: tu inversión también crea el contrato del proyecto.", "Refund if goal missed": "Reembolso si no hay meta", "No admin keys": "Sin administrador", "Paid in voted stages": "Pago por etapas votadas", "Token logo": "Logo del token", "Optional. PNG, JPG or WebP. It's shown on your project card and is part of what you sign.": "Opcional. PNG, JPG o WebP. Aparece en la carta de tu proyecto y forma parte de lo que firmas.", "That logo is too big. Try a simpler image.": "Ese logo es muy pesado. Prueba con una imagen más simple.", "That file isn't an image we can read.": "Ese archivo no es una imagen que podamos leer.", "The token logo must be a PNG, JPG or WebP under 60 KB.": "El logo del token debe ser PNG, JPG o WebP de menos de 60 KB.", "Days left": "Días", "Main": "Principal", "Holdfast home": "Inicio de Holdfast",
  "The two halves of the Holdfast mark coming together": "Las dos mitades del logo de Holdfast uniéndose",
  "The Holdfast mark: two halves that come together and hold": "El logo de Holdfast: dos mitades que se unen y se sostienen",
  "Choose a category.": "Elige una categoría.", "Invalid colour.": "Color inválido.", "The one-line summary must be 10 to 120 characters.": "El resumen debe tener entre 10 y 120 caracteres.",
  "The description must be 40 to 2,000 characters.": "La descripción debe tener entre 40 y 2.000 caracteres.", "The name must be 3 to 40 characters.": "El nombre debe tener entre 3 y 40 caracteres.",
  "The ticker must be 2 to 8 capital letters or digits.": "El símbolo debe tener de 2 a 8 letras mayúsculas o números.", "The minimum goal must be at least 1 USDC.": "La meta mínima debe ser de al menos 1 USDC.",
  "The minimum goal can't be above the maximum.": "La meta mínima no puede superar la máxima.", "The team can't keep more tokens than backers get.": "El equipo no puede quedarse más tokens que los inversores.",
  "The raise must close 3 to 180 days from today.": "La ronda debe cerrar entre 3 y 180 días desde hoy.",
  "AI review isn't available for this project. Review it by hand before approving.": "La revisión con IA no está disponible para este proyecto. Revísalo a mano antes de aprobarlo.",
  "Only the platform owner can decide.": "Solo el dueño de la plataforma puede decidir.", "Signature expired. Open the panel again.": "La firma venció. Vuelve a abrir el panel.",
};

// Textos con números u otras partes variables.
const RULES = [
  [/^Goal of \$(.+) missed$/, (m) => `Si no se llega a $${m[1]}`], [/^about \$(.+) back$/, (m) => `recuperas cerca de $${m[1]}`], [/^Backer #(\d+)$/, (m) => `Inversor #${m[1]}`], [/^(.+) is funded$/, (m) => `${m[1]} está financiado`],
  [/^Raised of \$(.+)$/, (m) => `Recaudado de $${m[1]}`], [/^\$(.+) for (.+)$/, (m) => `$${m[1]} por ${m[2]}`],
  [/^100% back if the goal of \$(.+) isn't met$/, (m) => `Recuperas el 100% si no se llega a $${m[1]}`], [/^(.+)% upfront, then (\d+) voted releases$/, (m) => `${m[1]}% inicial y luego ${m[2]} entregas votadas`],
  [/^Back (?!with )(.+)$/, (m) => `Apoyar ${m[1]}`], [/^Minimum \$(.+)$/, (m) => `Mínimo $${m[1]}`], [/^\$(.+) left$/, (m) => `Faltan $${m[1]}`], [/^\$(.+) back$/, (m) => `Recuperas $${m[1]}`], [/^Token (.+)$/, (m) => `Token ${m[1]}`],
  [/^ backed $/, () => " invirtió en "], [/^ with (.+) USDC$/, (m) => ` con ${m[1]} USDC`],
  [/^ reached its goal$/, () => " llegó a su meta"], [/^ missed its goal, refunds open$/, () => " no llegó a su meta, reembolsos abiertos"],
  [/^(\d+) min ago$/, (m) => `hace ${m[1]} min`], [/^(\d+) h ago$/, (m) => `hace ${m[1]} h`], [/^(\d+) d ago$/, (m) => `hace ${m[1]} d`],
  [/^(\d+) days? left$/, (m) => `Quedan ${m[1]} día${m[1] === "1" ? "" : "s"}`],
  [/^(\d+) hours left$/, (m) => `Quedan ${m[1]} horas`],
  [/^Closed (.+)$/, (m) => `Cerró el ${m[1]}`],
  [/^ of \$(.+)$/, (m) => ` de $${m[1]}`],
  [/^of \$(.+)$/, (m) => `de $${m[1]}`],
  [/^min \$(.+)$/, (m) => `mín. $${m[1]}`],
  [/^(\d+) live$/, (m) => `${m[1]} publicados`],
  [/^(\d+(?:\.\d+)?)% raised$/, (m) => `${m[1]}% recaudado`],
  [/^Read live from the (.+) blockchain$/, (m) => `Leído en vivo de la blockchain ${tr(m[1])}`],
  [/^(.+), token (.+)\. $/, (m) => `${tr(m[1])}, token ${m[2]}. `],
  [/^If less than \$(.+) is raised by the close, every backer withdraws 100% of what they put in\. No fee\.$/, (m) => `Si al cierre se juntan menos de $${m[1]}, cada inversor retira el 100% de lo que puso. Sin comisión.`],
  [/^(.+)% when the raise closes, then (\d+) releases of (.+)%\. Backers vote on each one\.$/, (m) => `${m[1]}% al cerrar la ronda y luego ${m[2]} entregas de ${m[3]}%. Los inversores votan cada una.`],
  [/^Release (\d+)$/, (m) => `Entrega ${m[1]}`],
  [/^Voting until (.+)$/, (m) => `En votación hasta el ${m[1]}`],
  [/^The team must request it by (.+)$/, (m) => `El equipo debe pedirla antes del ${m[1]}`],
  [/^You get (.+)$/, (m) => `Recibes ${m[1]}`],
  [/^Balance (.+) USDC$/, (m) => `Saldo ${m[1]} USDC`],
  [/^Locked \$(.+)$/, (m) => `Guardado $${m[1]}`], [/^Released \$(.+)$/, (m) => `Entregado $${m[1]}`], [/^Fee \$(.+)$/, (m) => `Comisión $${m[1]}`],
  [/^Approve \$(.+)$/, (m) => `Aprueban $${m[1]}`], [/^Reject \$(.+)$/, (m) => `Rechazan $${m[1]}`],
  [/^Release (\d+) of (\d+)\. Voting closes (.+)\.$/, (m) => `Entrega ${m[1]} de ${m[2]}. La votación cierra el ${m[3]}.`],
  [/^Release (\d+) of (\d+)\. Voting has ended\.$/, (m) => `Entrega ${m[1]} de ${m[2]}. La votación terminó.`],
  [/^The team must request release (\d+) by (.+)\.$/, (m) => `El equipo debe pedir la entrega ${m[1]} antes del ${m[2]}.`],
  [/^Request release (\d+)$/, (m) => `Pedir la entrega ${m[1]}`],
  [/^(\d+) days$/, (m) => `${m[1]} días`],
  [/^\$(.+) to \$(.+)$/, (m) => `$${m[1]} a $${m[2]}`],
  [/^(\d+) releases of (.+)%$/, (m) => `${m[1]} entregas de ${m[2]}%`],
  [/^(\d+), every (\d+) days$/, (m) => `${m[1]}, cada ${m[2]} días`],
  [/^(.+) of (.+)$/, null], // no tocar otros "of" genéricos
  [/^If you raise \$(.+) and backers approve every release, you receive \$(.+)\.$/, (m) => `Si juntas $${m[1]} y los inversores aprueban todas las entregas, recibes $${m[2]}.`],
  [/^You've received \$(.+)$/, (m) => `Recibiste $${m[1]}`],
  [/^(.+), sent by $/, (m) => `${tr(m[1])}, enviado por `],
  [/^Back with (.+) USDC$/, (m) => `Invertir ${m[1]} USDC`],
  [/^Not enough USDC: you have (.+)\.$/, (m) => `No te alcanza: tienes ${m[1]} USDC.`],
  [/^(.+): done$/, (m) => `${tr(m[1])}: listo`],
  [/^(Live|In review|Not approved), (.+)$/, (m) => `${tr(m[1])}, ${tr(m[2][0].toUpperCase() + m[2].slice(1)).toLowerCase()}`],
  [/^Colour (\d+)$/, (m) => `Color ${m[1]}`],
  [/^Invalid value: (.+)\.$/, (m) => `Dato inválido: ${m[1]}.`],
];

let lang = "en";
try { lang = localStorage.getItem("hf-lang") || (navigator.language || "").startsWith("es") && "es" || "en"; } catch {}

function tr(s) {
  if (lang !== "es") return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
  if (!core) return s;
  if (ES[core]) return lead + ES[core] + trail;
  for (const [re, fn] of RULES) {
    const m = s.match(re) || core.match(re);
    if (m) return fn ? (s.match(re) ? fn(m) : lead + fn(m) + trail) : s;
  }
  return s;
}

const ORIG = new WeakMap();
function translateNode(node) {
  if (node.nodeType === 3) {
    if (!ORIG.has(node)) ORIG.set(node, node.nodeValue);
    const want = tr(ORIG.get(node));
    if (node.nodeValue !== want) node.nodeValue = want;
    return;
  }
  if (node.nodeType !== 1 || node.tagName === "SCRIPT" || node.tagName === "STYLE") return;
  for (const a of ["placeholder", "aria-label", "title"]) {
    if (!node.hasAttribute(a)) continue;
    const key = "data-en-" + a;
    if (!node.hasAttribute(key)) node.setAttribute(key, node.getAttribute(a));
    node.setAttribute(a, tr(node.getAttribute(key)));
  }
  node.childNodes.forEach(translateNode);
}

let busy = false;
const obs = new MutationObserver((muts) => {
  if (busy) return;
  busy = true;
  for (const m of muts) {
    if (m.type === "characterData") { ORIG.set(m.target, m.target.nodeValue); translateNode(m.target); }
    m.addedNodes.forEach(translateNode);
  }
  busy = false;
});

function apply() {
  document.documentElement.lang = lang;
  busy = true; translateNode(document.body); busy = false;
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang ? "true" : "false"));
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem("hf-lang", l); } catch {}
  apply();
}
export const getLang = () => lang;

export function initI18n() {
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-lang]"); if (b) setLang(b.dataset.lang); });
  apply();
}
