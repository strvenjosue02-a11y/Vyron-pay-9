// Cambio de idioma EN/ES. La interfaz se escribe en inglés; este módulo traduce al español
// los textos visibles (y placeholder/aria-label/title) cada vez que cambian, sin tocar la lógica.

const ES = {
  "Tokens": "Tokens", "Search token": "Buscar token",
  "Time left": "Tiempo restante", "Expired": "Expiró", "Recover my money": "Recuperar mi dinero", "Market open": "Mercado abierto", "The round filled. The pool is locked forever.": "La ronda se llenó. El pool queda bloqueado para siempre.", "See the pool": "Ver el pool", "Claim my tokens": "Reclamar mis tokens", "Nothing left to claim.": "No tienes tokens por reclamar.", "Enter an amount.": "Escribe un monto.",
  "Share my position": "Compartir mi posición", "Making your card…": "Preparando tu tarjeta…", "Pro": "Pro", "Simple": "Simple",
  "Your share of tokens": "Tu parte de los tokens", "Released over": "Se liberan en", "wk": "sem", "Creating on the network…": "Creando en la red…",
  "buyers": "compradores", "sellers": "vendedores", "trades/min": "operaciones/min", "new holders (24h)": "holders nuevos (24h)", "sold everything": "vendieron todo", "sold some": "vendieron una parte", "still holding": "siguen con tokens",
  "Age": "Edad", "Guarantees": "Garantías", "No admin: nobody can change the rules": "Sin admin: nadie puede cambiar las reglas", "Nobody can create new tokens": "Nadie puede crear tokens nuevos", "Nobody can freeze trading": "Nadie puede congelar las operaciones", "Liquidity locked forever": "Liquidez bloqueada para siempre", "Team tokens released slowly": "Tokens del equipo con goteo", "Total balance": "Balance total", "Your positions": "Tus posiciones", "total profit": "de ganancia total", "No tokens yet. Buy one and it shows here.": "Aún no tienes tokens. Compra uno y aparece aquí.", "24h high": "Máximo 24h", "24h low": "Mínimo 24h",
  "The glow inside the chart shows where people bought. Green zones: they are winning. Red zones: they are losing and might sell.": "La luz dentro del gráfico muestra dónde compró la gente. Zonas verdes: están ganando. Zonas rojas: están perdiendo y podrían vender.",
  "Each bar is a price; the longer, the more tokens were bought there. Green = bought below today's price (winning). Red = bought above (losing).": "Cada barra es un precio; cuanto más larga, más tokens se compraron ahí. Verde = comprado por debajo del precio de hoy (ganando). Rojo = comprado por encima (perdiendo).",
  "Heatmap": "Mapa de calor", "of tokens are in profit": "de los tokens están en ganancia", "Whale radar": "Radar de ballenas", "No whale has traded yet.": "Ninguna ballena ha operado aún.", "bought": "compró", "sold": "vendió", "No trades yet.": "Aún no hay operaciones.", "Each bar is a price. Bar length = how many tokens were bought there. <span class=\"u\">Green</span> = bought below today's price (winning). <span class=\"d\">Red</span> = bought above (losing).": "Cada barra es un precio. Largo de la barra = cuántos tokens se compraron ahí. Verde = comprado por debajo del precio de hoy (ganando). Rojo = comprado por encima (perdiendo).",
  "Info": "Info", "Safety": "Seguridad", "Creator": "Creador", "Contract": "Contrato", "Links": "Enlaces", "No links added": "Sin enlaces", "Trending": "En tendencia", "rounds filled": "rondas llenas", "did not fill": "no se llenaron", "sold own tokens": "vendió sus tokens", "Yes": "Sí", "No": "No",
  "Liquidity locked forever": "Liquidez bloqueada para siempre", "Locked forever": "Bloqueada para siempre", "Liquidity": "Liquidez", "Opens a pool at the round price, locked forever.": "Abre un pool al precio de la ronda, bloqueado para siempre.", "Every Holdfast token with an open Uniswap pool. Anyone can buy with USDC; liquidity is locked forever: nobody can take it out.": "Todos los tokens de Holdfast con un pool abierto en Uniswap. Cualquiera puede comprar con USDC; la liquidez está bloqueada para siempre: nadie puede sacarla.", "The pool was created by the project's contract at the round price. Its liquidity is locked in the contract forever: nobody can take it out.": "El pool lo creó el contrato del proyecto al precio de la ronda. Su liquidez está bloqueada en el contrato para siempre: nadie puede sacarla.",
  "Filter": "Filtrar", "New launches": "Lanzamientos nuevos", "Liquidity over $1K": "Liquidez sobre $1K", "Going up": "Subiendo", "tokens": "tokens", "No token matches. Try removing a filter.": "Ningún token coincide. Prueba quitar un filtro.", "Market cap": "Valor total", "NEW": "NUEVO",
  "One-tap buy: quick amounts buy instantly": "Compra de un toque: los montos rápidos compran al instante", "Browser alerts": "Alertas del navegador", "Browser alerts on": "Alertas activadas", "Browser alerts blocked": "Alertas bloqueadas", "Address copied": "Dirección copiada", "Could not copy": "No se pudo copiar", "Explorer": "Explorador", "Pool": "Pool",
  "Your rank": "Tu puesto", "Be the first trader on": "Sé el primer trader en", "Bronze": "Bronce", "Silver": "Plata", "Gold": "Oro", "Diamond": "Diamante", "In the red": "En rojo", "You are #1": "Vas de #1", "Buys": "Compras", "Sells": "Ventas", "trades": "operaciones", "traders": "traders", "Replay": "Repetir", "Stop": "Parar", "Sound": "Sonido", "Follow": "Seguir", "Following": "Siguiendo", "Entry": "Entrada",
  "Checking safety…": "Revisando seguridad…", "Take profit / Stop loss": "Take profit / Stop loss", "Take profit": "Take profit", "Stop loss": "Stop loss", "Turn on": "Activar", "When the price gets there I alert you and get the sell ready. You sign with one tap.": "Cuando el precio llegue, te aviso y dejo la venta lista. Firmas con un toque.", "Comments": "Comentarios", "Post": "Publicar", "Write a comment…": "Escribe un comentario…", "Sell 50%": "Vender 50%", "Sell all": "Vender todo", "Avg entry": "Entrada media", "Liquidity unlocked": "Liquidez sin bloqueo", "Team has sold": "El equipo ya vendió", "Team hasn't sold": "El equipo no ha vendido", "Buy": "Comprar", "Sell": "Vender", "No position yet. Buy": "Aún sin posición. Compra",
  "Connect wallet to buy": "Conectar wallet para comprar", "Connect wallet to sell": "Conectar wallet para vender", "Download image": "Descargar imagen", "Edit my profile": "Editar mi perfil", "Position": "Posición", "Waiting for the first trade…": "Esperando la primera operación…", "Market cap": "Valor total", "Holders": "Holders",
  "Launch it.": "Lánzalo.", "Fill it.": "Llénalo.", "Trade it.": "Tradéalo.", "Put money in. If it fills, trading opens. If it doesn't, take it out.": "Mete dinero. Si se llena, se abre el mercado. Si no, lo sacas.", "See launches": "Ver lanzamientos", "Launch": "Lanzar",
  "Launches": "Lanzamientos",
  "Price / Market cap": "Precio / Valor total", "Market cap": "Valor total",
  "Investor": "Inversor", "Creator + Owner": "Creador + Dueño", "Skip 7 days": "Saltar 7 días", "Simulated chain, fake money. Switch who you are:": "Cadena simulada, dinero falso. Cambia quién eres:", "7 days later": "7 días después",
  "Slippage": "Tolerancia", "Balance": "Saldo", "Safety": "Seguridad",
  "Make a winning trade to unlock your PnL card.": "Haz una operación ganadora para desbloquear tu tarjeta de ganancia.", "Make a winning trade first.": "Primero haz una operación ganadora.", "Search token": "Buscar token", "No token found.": "No se encontró ningún token.",
  "Top traders": "Mejores traders", "Today": "Hoy", "Week": "Semana", "All time": "Siempre", "Edit my profile": "Editar mi perfil", "No trades in this period yet.": "Aún no hay operaciones en este período.", "Bought": "Compró", "Sold": "Vendió", "Trades": "Operaciones", "Best sale": "Mejor venta", "Holding now": "Tiene ahora", "Worth today": "Vale hoy",
  "My trader profile": "Mi perfil de trader", "Tap to choose a photo": "Toca para elegir una foto", "Username": "Nombre de usuario", "Optional and public. Signing is free and moves no money.": "Opcional y público. Firmar es gratis y no mueve dinero.", "Sign and save": "Firmar y guardar", "Profile saved": "Perfil guardado",
  "Markets": "Mercados", "All tokens": "Todos los tokens", "My PnL card": "Mi tarjeta de ganancia", "Download": "Descargar",
  "Whales": "Ballenas", "Share": "Compartir", "Image saved": "Imagen guardada", "No big trades yet.": "Todavía no hay operaciones grandes.",
  "Minimum you'll get": "Mínimo que recibes", "Pool fee": "Comisión del pool", "Your position": "Tu posición", "You hold": "Tienes", "Worth today": "Vale hoy", "vs what you paid": "frente a lo que pagaste", "More data": "Ver más datos", "Less": "Ver menos", "Show more": "Ver más",
  "The price changed while you were trading. You didn't lose anything: try again or raise the slippage.": "El precio cambió mientras operabas. No perdiste nada: intenta otra vez o sube la tolerancia.", "You cancelled it in your wallet. Nothing happened.": "Lo cancelaste en tu wallet. No pasó nada.",
  "Your wallet needs a little ETH to pay the network fee.": "Tu wallet necesita un poco de ETH para pagar la comisión de la red.", "Something failed and nothing was charged. Try again.": "Algo falló y no se cobró nada. Intenta otra vez.",
  "24h high": "Máximo 24h", "24h low": "Mínimo 24h", "Market cap": "Valor total", "Liquidity": "Liquidez", "My trades": "Mis operaciones", "Price alert": "Alerta de precio", "Set": "Activar", "Update": "Actualizar",
  "We'll show a notice here when the price crosses it.": "Te avisamos aquí cuando el precio llegue a ese valor.", "Safety": "Seguridad", "Liquidity locked until": "Liquidez bloqueada hasta", "Pool health": "Salud del pool", "Healthy": "Sana", "Medium": "Media", "Thin: prices move fast": "Baja: el precio se mueve rápido",
  "Team tokens": "Tokens del equipo", "See the project, its releases and votes →": "Ver el proyecto, sus entregas y votos →", "Prices can go up or down. Holdfast doesn't control the market.": "El precio puede subir o bajar. Holdfast no controla el mercado.",
  "Top volume": "Más volumen", "Gainers": "Más suben", "Losers": "Más bajan", "★ Favorites": "★ Favoritos", "Tap ★ on a token to follow it.": "Toca ★ en un token para seguirlo.", "Connect your wallet to see your trades.": "Conecta tu wallet para ver tus operaciones.", "Alert removed": "Alerta quitada",
  "Payments go to your wallet": "Los pagos llegan a tu wallet", "The same wallet that signs. Every approved release lands here automatically, in USDC.": "La misma wallet que firma. Cada entrega aprobada llega aquí sola, en USDC.",
  "Your investment": "Tu inversión", "Your tokens": "Tus tokens", "100% protected until the raise closes": "100% protegido hasta que cierre la ronda", "Get my backer card →": "Mi carta de inversor →", "Claim my tokens": "Reclamar mis tokens", "Get my money back": "Recuperar mi dinero", "Back more": "Invertir más",
  "They promised": "Prometieron", "Check the Updates tab, then vote. Your vote weighs as much as you put in.": "Revisa la pestaña Avances y luego vota. Tu voto pesa lo que invertiste.", "Approve release": "Aprobar entrega", "Reject": "Rechazar", "You voted on this release. Results update live.": "Ya votaste en esta entrega. Los resultados se actualizan en vivo.", "Only backers can vote.": "Solo los inversores pueden votar.", "Voting ended": "Votación terminada", "Release vote": "Votación de entrega",
  "Rejected once · second chance until": "Rechazada una vez · segunda oportunidad hasta",
  "Creator studio": "Estudio del creador", "Your projects, what needs your attention, and your reputation as backers see it.": "Tus proyectos, lo que necesita tu atención y tu reputación tal como la ven los inversores.", "Needs your attention": "Necesita tu atención", "Your projects": "Tus proyectos", "Your reputation": "Tu reputación",
  "This is what backers see on every project you launch. It can't be edited: it comes from the blockchain.": "Esto es lo que ven los inversores en cada proyecto que lances. No se puede editar: viene de la blockchain.", "Updates posted": "Avances publicados", "Post update": "Publicar avance", "Open project": "Abrir proyecto", "Paid to you": "Pagado a ti", "Request release": "Pedir entrega", "Answer": "Responder", "In review": "En revisión", "No update in 30 days": "Sin avances en 30 días", "Releases": "Entregas", "Raised": "Recaudado",
  "Four short steps. Holdfast reviews every project before it goes live. Signing is free.": "Cuatro pasos cortos. Holdfast revisa cada proyecto antes de publicarlo. Firmar es gratis.", "Project": "Proyecto", "Money": "Dinero", "Review": "Revisar",
  "Your project": "Tu proyecto", "Your team": "Tu equipo", "The money": "El dinero", "Review and sign": "Revisar y firmar", "Cover image": "Imagen de portada", "Upload cover · 4:3 · it's the first thing backers see": "Subir portada · 4:3 · es lo primero que ven los inversores",
  "Square. So people recognise your token.": "Cuadrado. Para que reconozcan tu token.", "Official links": "Links oficiales", "At least one. Backers use them to check you exist.": "Al menos uno. Los inversores los usan para comprobar que existes.",
  "Main risks": "Riesgos principales", "Be honest: what could go wrong and how you'd handle it.": "Sé honesto: qué podría salir mal y cómo lo manejarías.", "We're anonymous": "Somos anónimos",
  "Allowed with protected mode: 0% upfront, at least 5 small releases voted by backers, and up to $10,000 on your first project. The most anyone could lose is one release.": "Se permite con modo protegido: 0% al inicio, mínimo 5 entregas pequeñas votadas por los inversores y hasta $10.000 en tu primer proyecto. Lo máximo que alguien podría perder es una entrega.",
  "Add up to 4 people with a photo and a public link (X, GitHub, LinkedIn or a website).": "Agrega hasta 4 personas con foto y un link público (X, GitHub, LinkedIn o una web).", "How the money will be used": "Cómo se usará el dinero", "Must add up to 100%.": "Debe sumar 100%.", "Adds up to 100% ✓": "Suma 100% ✓",
  "Advanced: tokens, releases and market": "Avanzado: tokens, entregas y mercado", "What you deliver in each release": "Qué entregas en cada etapa", "Backers vote on each release against this promise.": "Los inversores votan cada entrega contra esta promesa.",
  "Unlocked with each approved release.": "Se liberan con cada entrega aprobada.", "Opens a pool at the round price, locked 12 months.": "Abre un pool al precio de la ronda, bloqueado para siempre.", "If you don't request it in time, the rest goes back to backers.": "Si no la pides a tiempo, lo que queda vuelve a los inversores.",
  "Signing is free and doesn't move money. Holdfast reviews your project; once approved it goes live and its contract is created by the first backer.": "Firmar es gratis y no mueve dinero. Holdfast revisa tu proyecto; al aprobarlo se publica y su contrato lo crea el primer inversor.",
  "Continue": "Continuar", "Back": "Atrás", "Live preview": "Vista previa en vivo", "Your one-line summary appears here": "Tu resumen en una frase aparece aquí", "Paid to you": "Te pagan", "Team": "Equipo", "Anonymous · protected mode": "Anónimo · modo protegido",
  "Everything looks complete. Sign to send it for review.": "Todo está completo. Firma para enviarlo a revisión.", "Links": "Links", "Use of funds": "Uso del dinero", "Development": "Desarrollo", "Security & audit": "Seguridad y auditoría", "Operations": "Operaciones",
  "Where the money is": "Dónde está el dinero", "Read live from the contract": "Leído en vivo del contrato", "Locked in the contract": "Bloqueado en el contrato", "Paid to the team": "Pagado al equipo", "In the market pool": "En el pool del mercado",
  "Creator track record": "Historial del creador", "Other projects": "Otros proyectos", "Releases delivered": "Entregas cumplidas", "Cancelled": "Cancelados", "First project from this creator": "Primer proyecto de este creador",
  "Their track record on Holdfast starts here. Every release they deliver, or miss, will show on their next projects.": "Su historial en Holdfast empieza aquí. Cada entrega que cumpla, o no, se verá en sus próximos proyectos.",
  "Updates": "Avances", "✓ Signed by the creator's wallet": "✓ Firmado por la wallet del creador", "Share progress with your backers: what shipped, links, numbers": "Cuéntale a tus inversores qué avanzaste: qué salió, links, números",
  "No updates yet. Every update here is signed by the creator's wallet, so no one else can post in their name.": "Aún no hay avances. Cada avance aquí va firmado por la wallet del creador, así nadie más puede publicar a su nombre.",
  "Market open": "Mercado abierto", "Funded": "Financiado", "Verified": "Verificado", "Trending": "En tendencia", "New": "Nuevos", "Ending soon": "Cierran pronto", "Search name or token": "Buscar nombre o token", "Load more": "Cargar más",
  "Nothing matches. Try another name or tab.": "No hay resultados. Prueba otro nombre o pestaña.", "Be the first backer": "Sé el primer inversor", "Until the raise closes": "Hasta que cierre la recaudación", "Market price": "Precio de mercado", "Details": "Detalles", "Safety": "Seguridad",
  "No admin keys · paid in voted stages": "Sin llaves de admin · pagos por etapas votadas", "You receive": "Recibes", "Status": "Estado",
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
  "Health": "Salud", "Food & drink": "Comida y bebida", "Other": "Otro", "Live numbers": "Cifras en vivo", "Live activity": "Actividad en vivo", "Live now": "En vivo", "Common": "Común", "Rare": "Rara", "Epic": "Épica", "Legendary": "Legendaria", "Raised": "Recaudado", "Market": "Mercado", "All markets": "Todos los mercados", "Every Holdfast token with an open Uniswap pool. Anyone can buy with USDC; liquidity is locked for 12 months.": "Todos los tokens de Holdfast con un pool abierto en Uniswap. Cualquiera puede comprar con USDC; la liquidez está bloqueada para siempre: nadie puede sacarla.", "Token": "Token", "vs round": "vs ronda", "Liquidity": "Liquidez", "24h volume": "Volumen 24h", "No token has a market yet. Markets open when a raise closes successfully.": "Todavía ningún token tiene mercado. Se abre cuando una ronda cierra con éxito.", "Trades": "Operaciones", "Top holders": "Principales tenedores", "Pool depth": "Profundidad del pool", "All": "Todo", "Move": "Mover", "Buy to push up": "Comprar para subir", "Sell to push down": "Vender para bajar", "How much it takes to move the price. Small pools move fast: check before large trades.": "Cuánto hace falta para mover el precio. Los pools chicos se mueven rápido: revisa antes de operar montos grandes.", "Uniswap pool": "Pool de Uniswap", "Project contract": "Contrato del proyecto", "Holdfast fee": "Comisión de Holdfast", "No holders yet.": "Todavía no hay tenedores.", "Loading holders…": "Cargando tenedores…", "Open trading terminal": "Abrir terminal de trading", "Back to the project": "Volver al proyecto", "Connect wallet": "Conectar wallet", "Candlestick chart": "Gráfico de velas", "Trade": "Mercado", "Market open": "Mercado abierto", "Buy": "Comprar", "Sell": "Vender", "You pay": "Pagas", "You sell": "Vendes", "Slippage 1%": "Tolerancia 1%", "Price impact": "Impacto en el precio", "Trades go straight to the Uniswap pool. Holdfast never holds your funds.": "Las operaciones van directo al pool de Uniswap. Holdfast nunca guarda tus fondos.", "Price": "Precio", "Round price": "Precio de la ronda", "Pool liquidity": "Liquidez del pool", "Liquidity unlocks": "Liquidez se desbloquea", "Recent trades": "Últimas operaciones", "No trades yet. Be the first.": "Todavía no hay operaciones. Sé el primero.", "View on Uniswap": "Ver en Uniswap", "Not enough liquidity": "No hay suficiente liquidez", "Enter an amount to trade.": "Escribe un monto para operar.", "Not enough balance.": "No te alcanza el saldo.", "Trade done": "Operación hecha", "Liquidity for the Uniswap market": "Liquidez para el mercado en Uniswap", "When the raise succeeds, this share of the funds and matching tokens open a Uniswap pool at the round price, locked for 12 months.": "Si la ronda tiene éxito, esta parte del dinero y los tokens equivalentes abren un pool en Uniswap al precio de la ronda, bloqueado 12 meses.", "Liquidity must be 5% to 25%.": "La liquidez debe ser de 5% a 25%.", "Price since the pool opened": "Precio desde que abrió el pool", "Team": "Equipo", "Q&A": "Preguntas", "Simulate your backing": "Simula tu inversión", "Team stops after release 1": "Si el equipo se detiene tras la entrega 1", "Every release approved": "Todas las entregas aprobadas", "You keep all your tokens": "Conservas todos tus tokens", "Team details are provided and signed by the creator. Holdfast reviews them before approval.": "Los datos del equipo los escribe y firma el creador. Holdfast los revisa antes de aprobar.", "The team hasn't added profiles yet.": "El equipo todavía no agregó perfiles.", "Read live from the blockchain.": "Leído en vivo de la blockchain.", "No backers yet. Be the first: your backing also creates the contract.": "Todavía no hay inversores. Sé el primero: tu inversión también crea el contrato.", "Ask the team anything about this project": "Pregúntale al equipo lo que quieras sobre el proyecto", "Sign and ask": "Firmar y preguntar", "Connect your wallet to ask a question.": "Conecta tu wallet para hacer una pregunta.", "No questions yet.": "Todavía no hay preguntas.", "Backer": "Inversor", "Creator": "Creador", "Waiting for the creator's answer.": "Esperando la respuesta del creador.", "Write your answer": "Escribe tu respuesta", "Sign and answer": "Firmar y responder", "Get my backer card": "Mi carta de inversor", "Your backer card": "Tu carta de inversor", "Save it or share it. It shows your backing, not a financial instrument.": "Guárdala o compártela. Muestra tu apoyo; no es un instrumento financiero.", "Download": "Descargar", "Share": "Compartir", "Close": "Cerrar", "Goal reached": "Meta alcanzada", "Your team": "Tu equipo", "Backers trust teams they can see. Add up to 4 people with a public link (X, GitHub, LinkedIn or a website).": "Los inversores confían en equipos que pueden ver. Agrega hasta 4 personas con un enlace público (X, GitHub, LinkedIn o una web).", "Add team member": "Agregar persona", "Role": "Rol", "Ask a question": "Hacer una pregunta", "Answer": "Responder", "Sign with your wallet": "Firmar con tu wallet", "Question posted": "Pregunta publicada", "Answer posted": "Respuesta publicada", "Write at least 5 characters.": "Escribe al menos 5 caracteres.", "Investment simulator": "Simulador de inversión", "Amount to simulate": "Monto a simular", "Overview": "Resumen", "Protection": "Protección", "Updates": "Avances", "Backers": "Inversores", "Backers this week": "Inversores esta semana", "Back now": "Invertir", "Enter an amount": "Escribe un monto", "Key numbers": "Cifras clave", "Project sections": "Secciones del proyecto", "Amount": "Monto", "You receive": "Recibes", "If the goal is missed": "Si no llegan a la meta", "100% back": "Recuperas el 100%", "Network fee": "Costo de red", "Less than $0.01": "Menos de $0,01", "A few cents, once": "Unos centavos, una vez", "Your balance": "Tu saldo", "You're early: your backing also creates this project's contract.": "Eres de los primeros: tu inversión también crea el contrato del proyecto.", "Refund if goal missed": "Reembolso si no hay meta", "No admin keys": "Sin administrador", "Paid in voted stages": "Pago por etapas votadas", "Token logo": "Logo del token", "Optional. PNG, JPG or WebP. It's shown on your project card and is part of what you sign.": "Opcional. PNG, JPG o WebP. Aparece en la carta de tu proyecto y forma parte de lo que firmas.", "That logo is too big. Try a simpler image.": "Ese logo es muy pesado. Prueba con una imagen más simple.", "That file isn't an image we can read.": "Ese archivo no es una imagen que podamos leer.", "The token logo must be a PNG, JPG or WebP under 60 KB.": "El logo del token debe ser PNG, JPG o WebP de menos de 60 KB.", "Days left": "Días", "Main": "Principal", "Holdfast home": "Inicio de Holdfast",
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
  [/^(.+) · #(\d+) on (.+)$/, (m) => `${m[1]} · #${m[2]} en ${m[3]}`], [/^\((\d+) buy · (\d+) sell\)$/, (m) => `(${m[1]} compras · ${m[2]} ventas)`],
  [/^Whale (bought|sold) \$(.+) of (.+)$/, (m) => `Una ballena ${m[1] === "bought" ? "compró" : "vendió"} $${m[2]} de ${m[3]}`],
  [/^Trades of \$(\d+) or more \(5% of the pool\)\. Big buys can push the price up; big sells can push it down\.$/, (m) => `Operaciones de $${m[1]} o más (5% del pool). Las compras grandes pueden subir el precio; las ventas grandes, bajarlo.`],
  [/^([+-]?[\d.]+)% 24h$/, (m) => `${m[1]}% 24h`], [/^Unlock only with approved releases \((\d+)\/(\d+)\)$/, (m) => `Se liberan solo con entregas aprobadas (${m[1]}/${m[2]})`],
  [/^You haven't traded (.+) yet\.$/, (m) => `Todavía no operaste ${m[1]}.`], [/^Alert set at \$(.+)$/, (m) => `Alerta activada en $${m[1]}`], [/^(.+) reached \$(.+)$/, (m) => `${m[1]} llegó a $${m[2]}`],
  [/^Confirm: moves the price (.+)%$/, (m) => `Confirmar: mueve el precio ${m[1]}%`], [/^High price impact \((.+)%\)\. Tap again to confirm\.$/, (m) => `Impacto alto en el precio (${m[1]}%). Toca otra vez para confirmar.`],
  [/^One wallet holds (.+)% of the supply\. If it sells, the price can drop fast\.$/, (m) => `Una wallet tiene el ${m[1]}% de los tokens. Si vende, el precio puede caer rápido.`],
  [/^USDC in your wallet (.+)$/, (m) => `USDC en tu wallet ${m[1]}`],
  [/^(\d+)% of your money is still protected$/, (m) => `El ${m[1]}% de tu dinero sigue protegido`], [/^Buy or sell (.+)$/, (m) => `Comprar o vender ${m[1]}`], [/^Refund ready: (.+)$/, (m) => `Reembolso listo: ${m[1]}`],
  [/^Release (\d+) of (\d+)( · second chance)?$/, (m) => `Entrega ${m[1]} de ${m[2]}${m[3] ? " · segunda oportunidad" : ""}`],
  [/^Closes (.+)$/, (m) => `Cierra el ${m[1]}`], [/^Vote on release (\d+)$/, (m) => `Votación de la entrega ${m[1]}`],
  [/^Approve \$(.+?)( · (\d+)%)?$/, (m) => `Aprobar $${m[1]}${m[2] ? ` · ${m[3]}%` : ""}`], [/^Reject \$(.+?)( · (\d+)%)?$/, (m) => `Rechazar $${m[1]}${m[2] ? ` · ${m[3]}%` : ""}`],
  [/^Rejected once · second chance until (.+)$/, (m) => `Rechazada una vez · segunda oportunidad hasta el ${m[1]}`],
  [/^Voting until (.+) · second chance$/, (m) => `Votación hasta el ${m[1]} · segunda oportunidad`],
  [/^(\d+) days left in your raise$/, (m) => `Quedan ${m[1]} días de recaudación`],
  [/^Request release (\d+) within (\d+) days$/, (m) => `Pide la entrega ${m[1]} en ${m[2]} días`],
  [/^Backers are voting on release (\d+)$/, (m) => `Los inversores están votando la entrega ${m[1]}`],
  [/^(\d+) questions? waiting for your answer$/, (m) => `${m[1]} pregunta${m[1] === "1" ? "" : "s"} esperando tu respuesta`],
  [/^(.+) · Deadline (.+)\. If you miss it, what's left returns to backers\.$/, (m) => `${m[1]} · Fecha límite ${m[2]}. Si no llegas, lo que queda vuelve a los inversores.`],
  [/^(.+) · Backers trust teams that show progress\. Post an update\.$/, (m) => `${m[1]} · Los inversores confían en equipos que muestran avances. Publica uno.`],
  [/^(.+) · \$(.+) of \$(.+) raised\. Share your project to reach the goal\.$/, (m) => `${m[1]} · $${m[2]} de $${m[3]} recaudado. Comparte tu proyecto para llegar a la meta.`],
  [/^(.+) · Answering fast builds trust\.$/, (m) => `${m[1]} · Responder rápido genera confianza.`],
  [/^Backers rejected release (\d+)\. Second chance: the team has until (.+) to show progress and ask again\. No money is released meanwhile; if they lose again, what's left returns to backers\.$/, (m) => `Los inversores rechazaron la entrega ${m[1]}. Segunda oportunidad: el equipo tiene hasta el ${m[2]} para mostrar avances y pedirla de nuevo. Mientras tanto no se libera dinero; si vuelve a perder, lo que queda regresa a los inversores.`],
  [/^Second chance: present release (\d+) again within (\d+) days$/, (m) => `Segunda oportunidad: presenta la entrega ${m[1]} de nuevo en ${m[2]} días`],
  [/^Connect your wallet to buy or sell (.+)\. Anyone can buy with USDC\.$/, (m) => `Conecta tu wallet para comprar o vender ${m[1]}. Cualquiera puede comprar con USDC.`], [/^(.+) \/ USDC$/, (m) => `${m[1]} / USDC`],
  [/^In pool \$(.+)$/, (m) => `En el pool $${m[1]}`],
  [/^per (.+)$/, (m) => `por ${m[1]}`], [/^([+-]?[\d.]+)% vs round price$/, (m) => `${m[1]}% frente al precio de la ronda`], [/^Buy ([A-Z0-9]+)$/, (m) => `Comprar ${m[1]}`], [/^Sell ([A-Z0-9]+)$/, (m) => `Vender ${m[1]}`], [/^Balance (.+)$/, (m) => `Saldo ${m[1]}`],
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
