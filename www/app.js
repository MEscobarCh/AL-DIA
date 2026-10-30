// Configuración de Fechas
const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const hoy = new Date();
const mesActual = hoy.getMonth() + 1; // 1-12
const añoActual = hoy.getFullYear();

// ==========================================================================
// --- MÓDULO CENTRAL DE ESTANDARIZACIÓN DE FECHAS Y HORAS (AL-DIA) ---
// ==========================================================================

/**
 * Formatea una fecha o timestamp a 'DD/MM/YYYY, HH:mm' (24h estricto, sin segundos, es-PE)
 */
function formatearFechaHora(valor) {
    if (!valor) return "-";
    if (typeof valor === 'string') {
        const str = valor.trim();
        const match = str.match(/^(\d{1,2}\/\d{1,2}\/\d{4}),?\s*(\d{1,2}:\d{2})(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?$/i);
        if (match) {
            const dateParts = match[1].split('/');
            const d = dateParts[0].padStart(2, '0');
            const m = dateParts[1].padStart(2, '0');
            const y = dateParts[2];
            const h = match[2].padStart(5, '0');
            return `${d}/${m}/${y}, ${h}`;
        }
    }
    const fecha = valor instanceof Date ? valor : new Date(Number(valor) || valor);
    if (isNaN(fecha.getTime())) return String(valor);
    return fecha.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Formatea una fecha corta a 'DD/MM/YYYY' con ceros obligatorios
 */
function formatearFechaCorta(valor) {
    if (!valor) return "-";
    if (typeof valor === 'string') {
        const str = valor.trim();
        if (str.includes('-') && str.length === 10) {
            const partes = str.split('-');
            return `${partes[2].padStart(2, '0')}/${partes[1].padStart(2, '0')}/${partes[0]}`;
        }
        if (str.includes('/')) {
            const partes = str.split('/');
            if (partes.length === 3) {
                return `${partes[0].padStart(2, '0')}/${partes[1].padStart(2, '0')}/${partes[2]}`;
            }
        }
    }
    const fecha = valor instanceof Date ? valor : new Date(Number(valor) || valor);
    if (isNaN(fecha.getTime())) return String(valor);
    const d = String(fecha.getDate()).padStart(2, '0');
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const y = fecha.getFullYear();
    return `${d}/${m}/${y}`;
}

/**
 * Normaliza o calcula la fecha de emisión inmutable
 */
function obtenerFechaEmisionInmutable(pago) {
    if (pago && pago.fecha_emision && String(pago.fecha_emision).trim() !== "") {
        return formatearFechaHora(pago.fecha_emision);
    }
    const timestampBase = (pago && pago.fecha_pago_real) ? pago.fecha_pago_real : (pago && pago.id ? pago.id : Date.now());
    return formatearFechaHora(timestampBase);
}

// Exposición en ámbito global
if (typeof window !== 'undefined') {
    window.formatearFechaHora = formatearFechaHora;
    window.formatearFechaCorta = formatearFechaCorta;
    window.obtenerFechaEmisionInmutable = obtenerFechaEmisionInmutable;
}

// Inicialización de la App
document.addEventListener("DOMContentLoaded", () => {
    const elInitMes = document.getElementById('mes-actual-display');
    if (elInitMes) elInitMes.innerText = `${meses[mesActual - 1].toUpperCase()} ${añoActual}`;
    iniciarBaseDeDatos();
    generarDeudasDelMes();
    renderizarDashboard();
    
    // Inicializar módulo unificado de registro dinámico (Fase 2)
    iniciarModuloRegistro();

    // Inicializar listeners del historial financiero (Fase 5.0)
    iniciarListenersHistorial();
});

// --- BASE DE DATOS LOCAL ---
function iniciarBaseDeDatos() {
    if (!localStorage.getItem('aldia_clientes')) {
        // Cargar datos de prueba
        const clientesPrueba = [
            { id: 1, nombre: "Juan", apellido: "García", telefono: "", monto: 350.00, dia: 28, activo: true, ref: "Cuarto 301" }
        ];
        const pagosPrueba = [
            { id: 101, cliente_id: 1, mes: mesActual, año: añoActual, monto: 350.00, pagado: true, metodo: "Yape/Plin", historico: "Juan García" }
        ];
        localStorage.setItem('aldia_clientes', JSON.stringify(clientesPrueba));
        localStorage.setItem('aldia_pagos', JSON.stringify(pagosPrueba));
    }
    // Nueva base de datos para egresos
    if (!localStorage.getItem('aldia_egresos')) {
        localStorage.setItem('aldia_egresos', JSON.stringify([]));
    }
    if (!localStorage.getItem('aldia_habitaciones')) {
        localStorage.setItem('aldia_habitaciones', JSON.stringify([]));
    }
    if (!localStorage.getItem('aldia_servicios')) {
        localStorage.setItem('aldia_servicios', JSON.stringify([]));
    }
}

// --- RELOJ AUTOMÁTICO (Genera nuevas cuotas) ---
// --- RELOJ AUTOMÁTICO (Genera nuevas cuotas evaluando fechas futuras) ---
// --- RELOJ AUTOMÁTICO (Solo genera para el mes real actual) ---
function generarDeudasDelMes() {
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let cambios = false;

    clientes.forEach(cli => {
        if (cli.activo) {
            let tocaCobrar = true; 
            
            if (cli.fecha_inicio) {
                let [anioIni, mesIni, diaIni] = cli.fecha_inicio.split('-').map(Number);
                // IMPORTANTE: Volvemos a calcular solo en base al mes y año REAL actual
                tocaCobrar = (añoActual > anioIni) || (añoActual === anioIni && mesActual >= mesIni);
            }

            if (tocaCobrar) {
                // Solo creamos el registro si estamos en el mes real
                let pagoExiste = pagos.find(p => p.cliente_id === cli.id && p.mes === mesActual && p.año === añoActual);
                if (!pagoExiste) {
                    pagos.push({
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        cliente_id: cli.id,
                        mes: mesActual,
                        año: añoActual,
                        monto: cli.monto,
                        pagado: false,
                        metodo: "",
                        historico: `${cli.nombre} ${cli.apellido}`.trim()
                    });
                    cambios = true;
                }
            }
        }
    });

    if (cambios) localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
}

// --- RENDERIZADO DEL DASHBOARD (Con Proyección Inteligente) ---
// --- RENDERIZADO DEL DASHBOARD ---
function renderizarDashboard() {
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];

    let fechaHoy = new Date();
    let diaHoy = fechaHoy.getDate();
    
    let esMesActualReal = (mesVisualizado === mesActual && añoVisualizado === añoActual);
    let esMesFuturo = (añoVisualizado > añoActual) || (añoVisualizado === añoActual && mesVisualizado > mesActual);
    let esMesPasado = (añoVisualizado < añoActual) || (añoVisualizado === añoActual && mesVisualizado < mesActual);

    let totalIngresos = 0;
    let totalEgresos = 0;
    let saldoPendiente = 0;

    let htmlPendientes = "";
    let htmlPagados = "";
    let htmlEgresos = "";

    let listaPendientes = [];

    clientes.forEach(cliente => {
        if (!cliente.activo) return;

        let tocaCobrar = true;
        if (cliente.fecha_inicio) {
            let [anioIni, mesIni] = cliente.fecha_inicio.split('-').map(Number);
            tocaCobrar = (añoVisualizado > anioIni) || (añoVisualizado === anioIni && mesVisualizado >= mesIni);
        }

        if (tocaCobrar) {
            // Detección bifurcada de pagos realizados y deudas pendientes (Fase 3.2 - Sin Deudas Huérfanas)
            let pagosCobrados = pagos.filter(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && !p.es_garantia && p.pagado);
            pagosCobrados.forEach(pago => {
                totalIngresos += parseFloat(pago.monto);

                let badgeHtml = "";
                let botonExtraHtml = "";

                if (cliente.tipo_servicio === 'streaming') {
                    badgeHtml = `<span class="badge bg-dark text-white rounded-pill px-2 py-1" style="font-size: 0.7rem;"><i class="fas fa-tv me-1"></i>${cliente.ref || 'Streaming'}</span>`;
                    botonExtraHtml = `<button class="btn btn-info rounded-circle shadow-sm text-white me-2" style="width: 35px; height: 35px; padding: 0;" onclick="sumarDiasStreaming(${cliente.id}, '${cliente.nombre}')" title="Añadir días extra"><i class="fas fa-hourglass-half"></i></button>`;
                } else {
                    badgeHtml = `<span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1" style="font-size: 0.7rem;"><i class="fas fa-home me-1"></i>${cliente.ref || 'Sin ref'}</span>`;
                }

                // Extracción limpia de fecha
                const fechaBase = pago.fecha_pago_real ? new Date(Number(pago.fecha_pago_real)) : new Date(Number(pago.id));
                let fechaTexto = "";
                if (!isNaN(fechaBase.getTime())) {
                    let d = fechaBase.getDate().toString().padStart(2, '0');
                    let m = (fechaBase.getMonth() + 1).toString().padStart(2, '0');
                    fechaTexto = `${d}/${m}`;
                }

                htmlPagados += `
                <div class="card-custom p-3 shadow-sm border-start border-4 border-success mb-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1 fw-bold text-dark d-flex align-items-center gap-2 flex-wrap">
                                ${cliente.nombre}
                                ${badgeHtml}
                            </h6>
                            <small class="text-muted"><i class="fas fa-wallet me-1"></i> ${pago.metodo || 'Efectivo'}${fechaTexto ? ` &bull; <i class="far fa-calendar-alt me-1"></i>${fechaTexto}` : ''}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="fw-bold text-success fs-5 me-2">S/ ${parseFloat(pago.monto).toFixed(2)}</span>
                            ${botonExtraHtml}
                            <button class="btn btn-sm btn-outline-secondary rounded-circle shadow-sm" style="width: 35px; height: 35px; padding: 0;" onclick="revertirPago(${pago.id}, '${cliente.nombre}', ${pago.monto})" title="Revertir cobro"><i class="fas fa-undo-alt"></i></button>
                        </div>
                    </div>
                </div>`;
            });

            let pagoPendiente = pagos.find(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && !p.es_garantia && !p.pagado);
            if (pagoPendiente) {
                listaPendientes.push({ tipo: 'cuota', cliente: cliente, pagoPendiente: pagoPendiente });
            } else if (pagosCobrados.length === 0) {
                listaPendientes.push({ tipo: 'cuota', cliente: cliente, pagoPendiente: null });
            }
        }

        // ==========================================
        // --- LÓGICA DE GARANTÍA PAGADA (NUEVO) ---
        // ==========================================
        let pagoGarantia = pagos.find(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && p.es_garantia && p.pagado);

        if (pagoGarantia) {
            totalIngresos += parseFloat(pagoGarantia.monto);
            const fechaGarBase = pagoGarantia.fecha_pago_real ? new Date(Number(pagoGarantia.fecha_pago_real)) : new Date(Number(pagoGarantia.id));
            let fechaGarTexto = "";
            if (!isNaN(fechaGarBase.getTime())) {
                let d = fechaGarBase.getDate().toString().padStart(2, '0');
                let m = (fechaGarBase.getMonth() + 1).toString().padStart(2, '0');
                fechaGarTexto = `${d}/${m}`;
            }

            htmlPagados += `
            <div class="card-custom p-3 shadow-sm border-start border-4 border-success mb-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1 fw-bold text-dark d-flex align-items-center gap-2 flex-wrap">
                            ${cliente.nombre} 
                            <span class="badge bg-success text-white rounded-pill px-2 py-1" style="font-size: 0.65rem;"><i class="fas fa-shield-alt me-1"></i>Garantía</span>
                        </h6>
                        <small class="text-muted"><i class="fas fa-wallet me-1"></i> ${pagoGarantia.metodo}${fechaGarTexto ? ` &bull; <i class="far fa-calendar-alt me-1"></i>${fechaGarTexto}` : ''}</small>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-bold text-success fs-5 me-2">S/ ${parseFloat(pagoGarantia.monto).toFixed(2)}</span>
                        <button class="btn btn-sm btn-outline-secondary rounded-circle shadow-sm" style="width: 35px; height: 35px; padding: 0;" onclick="revertirPago(${pagoGarantia.id}, '${cliente.nombre} (Garantía)', ${pagoGarantia.monto})" title="Revertir cobro"><i class="fas fa-undo-alt"></i></button>
                    </div>
                </div>
            </div>`;
        }

        // ==========================================
        // --- LÓGICA DE GARANTÍA PENDIENTE ---
        // ==========================================
        if (cliente.garantia_monto > 0 && !cliente.garantia_pagada) {
            if (cliente.garantia_fecha) {
                let [anioGar, mesGar, diaGar] = cliente.garantia_fecha.split('-').map(Number);
                let tocaCobrarGar = (añoVisualizado > anioGar) || (añoVisualizado === anioGar && mesVisualizado >= mesGar);

                if (tocaCobrarGar) {
                    listaPendientes.push({ tipo: 'garantia', cliente: cliente });
                }
            }
        }
    });

    // Prioridad a Morosos en la Lista:
    // Inyectar primero a quienes arrastran deudas anteriores y a quienes tienen mayor atraso
    let hoyCero = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate());
    listaPendientes.sort((a, b) => {
        let deudasPastA = pagos.filter(p => p.cliente_id === a.cliente.id && !p.pagado && !p.es_garantia && (p.año < añoVisualizado || (p.año === añoVisualizado && p.mes < mesVisualizado))).length;
        let deudasPastB = pagos.filter(p => p.cliente_id === b.cliente.id && !p.pagado && !p.es_garantia && (p.año < añoVisualizado || (p.año === añoVisualizado && p.mes < mesVisualizado))).length;
        if (deudasPastA !== deudasPastB) {
            return deudasPastB - deudasPastA; // Quienes arrastran más meses primero
        }

        let fechaA;
        if (a.tipo === 'garantia' && (a.cliente.garantia_fecha || a.cliente.fecha)) {
            let [anioA, mesA, diaA] = (a.cliente.garantia_fecha || a.cliente.fecha).split('-').map(Number);
            fechaA = new Date(anioA, mesA - 1, diaA);
        } else {
            fechaA = new Date(añoVisualizado, mesVisualizado - 1, a.cliente.dia || 1);
        }

        let fechaB;
        if (b.tipo === 'garantia' && (b.cliente.garantia_fecha || b.cliente.fecha)) {
            let [anioB, mesB, diaB] = (b.cliente.garantia_fecha || b.cliente.fecha).split('-').map(Number);
            fechaB = new Date(anioB, mesB - 1, diaB);
        } else {
            fechaB = new Date(añoVisualizado, mesVisualizado - 1, b.cliente.dia || 1);
        }

        let atrasoA = Math.round((hoyCero - fechaA) / (1000 * 60 * 60 * 24));
        let atrasoB = Math.round((hoyCero - fechaB) / (1000 * 60 * 60 * 24));
        return atrasoB - atrasoA; // Mayor atraso primero
    });

    // Renderizado con tarjetas destacadas y botón primario 'Registrar pago'
    listaPendientes.forEach(item => {
        let cliente = item.cliente;

        if (item.tipo === 'cuota') {
            let badgeHtml = "";
            let botonExtraHtml = "";

            if (cliente.tipo_servicio === 'streaming') {
                badgeHtml = `<span class="badge bg-dark text-white rounded-pill px-2 py-1" style="font-size: 0.7rem;"><i class="fas fa-tv me-1"></i>${cliente.ref || 'Streaming'}</span>`;
                botonExtraHtml = `<button class="btn btn-info btn-sm rounded-circle shadow-sm text-white" style="width: 32px; height: 32px; padding: 0;" onclick="sumarDiasStreaming(${cliente.id}, '${cliente.nombre}')" title="Añadir días extra"><i class="fas fa-hourglass-half" style="font-size: 0.75rem;"></i></button>`;
            } else {
                badgeHtml = `<span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1" style="font-size: 0.7rem;"><i class="fas fa-home me-1"></i>${cliente.ref || 'Sin ref'}</span>`;
            }

            let pago = item.pagoPendiente || pagos.find(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && !p.es_garantia && !p.pagado);
            let montoDeuda = pago ? pago.monto : cliente.monto;
            saldoPendiente += parseFloat(montoDeuda);

            let diaCobro = cliente.dia;
            let textoDias = "";
            let badgeEstadoDias = "";
            let alertaMora = "";

            // ALERTA: ¿Arrastra deudas anteriores?
            let deudasPasadas = pagos.filter(p => p.cliente_id === cliente.id && p.pagado === false && !p.es_garantia && (p.año < añoVisualizado || (p.año === añoVisualizado && p.mes < mesVisualizado)));
            if (deudasPasadas.length > 0) {
                alertaMora = `<div class="text-danger fw-bold mt-2 small d-flex align-items-center gap-1" style="font-size: 0.72rem;"><i class="fas fa-exclamation-triangle"></i> Arrastra ${deudasPasadas.length} mes(es) sin pagar</div>`;
            }

            // LÓGICA DE TIEMPOS Y BADGES
            if (esMesFuturo) {
                textoDias = "Próx. cuota";
                badgeEstadoDias = `<span class="badge bg-light text-muted border rounded-pill mt-1" style="font-size: 0.68rem;"><i class="far fa-calendar-alt me-1"></i>${textoDias}</span>`;
            } else {
                if (esMesPasado) {
                    textoDias = "¡Atrasado!";
                    badgeEstadoDias = `<span class="badge rounded-pill mt-1" style="font-size: 0.68rem; background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;"><i class="fas fa-clock me-1"></i>${textoDias}</span>`;
                } else if (diaCobro > diaHoy) {
                    let faltan = diaCobro - diaHoy;
                    textoDias = `faltan ${faltan} d`;
                    badgeEstadoDias = `<span class="badge bg-light text-muted border rounded-pill mt-1" style="font-size: 0.68rem;"><i class="far fa-calendar-alt me-1"></i>${textoDias}</span>`;
                } else if (diaCobro === diaHoy) {
                    textoDias = "¡Vence hoy!";
                    badgeEstadoDias = `<span class="badge rounded-pill mt-1" style="font-size: 0.68rem; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a;"><i class="fas fa-exclamation-circle me-1"></i>${textoDias}</span>`;
                } else {
                    let atraso = diaHoy - diaCobro;
                    textoDias = `atrasado ${atraso} d`;
                    badgeEstadoDias = `<span class="badge rounded-pill mt-1" style="font-size: 0.68rem; background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;"><i class="fas fa-clock me-1"></i>${textoDias}</span>`;
                }
            }

            let pagoIdTarget = pago ? pago.id : `'CREAR_' + cliente.id + '_' + mesVisualizado + '_' + añoVisualizado`;
            let claseBorde = deudasPasadas.length > 0 ? "border-start border-danger border-4" : "border-start border-warning border-4";
            let estiloBordeFondo = deudasPasadas.length > 0
                ? "border-left: 4px solid #ef4444 !important; background: #fffbfb;"
                : "border-left: 4px solid #f59e0b !important; background: #fffdf9;";

            // Tarjeta destacada con borde de alerta y botón primario 'Registrar pago'
            htmlPendientes += `
            <div class="card-custom p-3 shadow-sm ${claseBorde} mb-3" style="${estiloBordeFondo}">
                <div class="d-flex justify-content-between align-items-center">
                    <!-- Lado Izquierdo: Nombre, Badges y Botón de Acción Directo -->
                    <div class="flex-grow-1" style="min-width: 0; padding-right: 12px;">
                        <h6 class="mb-1 fw-bold text-dark d-flex align-items-center flex-wrap gap-2">
                            <span class="text-truncate" style="max-width: 100%;">${cliente.nombre}</span> 
                            ${badgeHtml}
                            <div class="d-inline-flex flex-nowrap">
                                <button class="btn btn-sm btn-link text-primary p-0" onclick="abrirModalEditarCliente(${cliente.id})" title="Editar"><i class="fas fa-edit fs-6"></i></button>
                                <button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="eliminarCliente(${cliente.id}, '${cliente.nombre}')" title="Dar de baja"><i class="fas fa-times-circle fs-6"></i></button>
                            </div>
                        </h6>
                        <!-- Botón de Acción Primario 'Registrar pago' reemplazando la fecha -->
                        <div class="d-flex align-items-center gap-2 mt-2 flex-wrap">
                            <button class="btn btn-primary btn-sm rounded-pill fw-bold px-3 py-1 shadow-sm d-inline-flex align-items-center gap-1" onclick="abrirModal(${pagoIdTarget}, '${cliente.nombre}', ${montoDeuda})" title="Registrar pago">
                                <i class="fas fa-hand-holding-usd"></i> Registrar pago
                            </button>
                            ${botonExtraHtml}
                        </div>
                        ${alertaMora}
                    </div>
                    
                    <!-- Lado Derecho: Monto y Badge de Atraso -->
                    <div class="d-flex flex-column align-items-end justify-content-center flex-shrink-0">
                        <span class="fw-bold text-dark fs-5">S/ ${parseFloat(montoDeuda).toFixed(2)}</span>
                        ${badgeEstadoDias}
                    </div>
                </div>
            </div>`;
        } else if (item.tipo === 'garantia') {
            let [anioGar, mesGar, diaGar] = cliente.garantia_fecha.split('-').map(Number);
            saldoPendiente += parseFloat(cliente.garantia_monto);
            
            let badgeEstadoGar = "";
            if (añoVisualizado === anioGar && mesVisualizado === mesGar) {
                if (diaGar > diaHoy && esMesActualReal) {
                    badgeEstadoGar = `<span class="badge bg-light text-muted border rounded-pill mt-1" style="font-size: 0.68rem;">faltan ${diaGar - diaHoy} d</span>`;
                } else if (diaGar === diaHoy && esMesActualReal) {
                    badgeEstadoGar = `<span class="badge rounded-pill mt-1" style="font-size: 0.68rem; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a;">¡Vence hoy!</span>`;
                } else if (diaGar < diaHoy && esMesActualReal) {
                    badgeEstadoGar = `<span class="badge rounded-pill mt-1" style="font-size: 0.68rem; background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;">atrasada</span>`;
                }
            } else {
                badgeEstadoGar = `<span class="badge rounded-pill mt-1" style="font-size: 0.68rem; background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;">¡Atrasada!</span>`;
            }

            htmlPendientes += `
            <div class="card-custom p-3 shadow-sm mb-3" style="border-left: 4px solid #1a3a8a !important; background: #f8fafc;">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1" style="min-width: 0; padding-right: 12px;">
                        <h6 class="mb-1 fw-bold text-dark d-flex align-items-center gap-2 flex-wrap">
                            <span class="text-truncate">${cliente.nombre}</span> 
                            <span class="badge bg-primary text-white rounded-pill px-2 py-1" style="font-size: 0.65rem;"><i class="fas fa-shield-alt me-1"></i>Garantía</span>
                        </h6>
                        <div class="d-flex align-items-center gap-2 mt-2">
                            <button class="btn btn-primary btn-sm rounded-pill fw-bold px-3 py-1 shadow-sm d-inline-flex align-items-center gap-1" onclick="abrirModalGarantia(${cliente.id}, '${cliente.nombre}', ${cliente.garantia_monto})" title="Registrar garantía">
                                <i class="fas fa-shield-alt"></i> Registrar garantía
                            </button>
                        </div>
                    </div>
                    <div class="d-flex flex-column align-items-end justify-content-center flex-shrink-0">
                        <span class="fw-bold text-dark fs-5">S/ ${parseFloat(cliente.garantia_monto).toFixed(2)}</span>
                        ${badgeEstadoGar}
                    </div>
                </div>
            </div>`;
        }
    });

    // 2. PROCESAR EGRESOS DEL MES VISUALIZADO (Suma para métricas sin lista redundante)
    let egresosDelMes = egresos.filter(e => e.mes === mesVisualizado && e.año === añoVisualizado);
    egresosDelMes.forEach(egreso => {
        totalEgresos += parseFloat(egreso.monto);
    });

    // 3. ACTUALIZAR INTERFAZ Y KPIs
    document.getElementById('total-ingresos').innerText = `S/ ${totalIngresos.toFixed(2)}`;
    document.getElementById('total-egresos').innerText = `S/ ${totalEgresos.toFixed(2)}`;
    
    // Calcular el Saldo Global Acumulado (Todos los meses históricos)
    let ingresosGlobales = pagos.filter(p => p.pagado).reduce((sum, p) => sum + parseFloat(p.monto), 0);
    let egresosGlobales = egresos.reduce((sum, e) => sum + parseFloat(e.monto), 0);
    let saldoGlobalAcumulado = ingresosGlobales - egresosGlobales;
    
    document.getElementById('saldo-mes').innerText = `S/ ${saldoGlobalAcumulado.toFixed(2)}`;

    // LÓGICA DE TARJETA POR COBRAR Y PROGRESO FUSIONADOS
    const elSaldoPendiente = document.getElementById('saldo-pendiente');
    const elBadgeEstadoCobranza = document.getElementById('badge-estado-cobranza');
    const elListaResumenDeudores = document.getElementById('lista-resumen-deudores');
    const elProgresoTexto = document.getElementById('progreso-cobranza-texto');
    const elProgresoBarra = document.getElementById('progreso-cobranza-barra');

    // Ratio de Cobranza del Mes
    let totalClientesMes = 0;
    let clientesAlDiaMes = 0;

    clientes.forEach(cliente => {
        if (!cliente.activo) return;
        let tocaCobrar = true;
        if (cliente.fecha_inicio) {
            let [anioIni, mesIni] = cliente.fecha_inicio.split('-').map(Number);
            tocaCobrar = (añoVisualizado > anioIni) || (añoVisualizado === anioIni && mesVisualizado >= mesIni);
        }
        if (tocaCobrar) {
            totalClientesMes++;
            let pagoCobrado = pagos.find(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && !p.es_garantia && p.pagado);
            let pagoPendiente = pagos.find(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && !p.es_garantia && !p.pagado);
            if (pagoCobrado && !pagoPendiente) {
                clientesAlDiaMes++;
            }
        }
    });

    let porcentajeCobranza = totalClientesMes > 0 ? Math.round((clientesAlDiaMes / totalClientesMes) * 100) : 100;

    if (elSaldoPendiente) {
        if (saldoPendiente <= 0) {
            elSaldoPendiente.innerText = "S/ 0.00";
            elSaldoPendiente.className = "fw-bold fs-3 mt-1 text-center text-secondary";
            elSaldoPendiente.style.color = "";
            if (elBadgeEstadoCobranza) {
                elBadgeEstadoCobranza.innerHTML = `<span class="badge bg-success rounded-pill px-2 py-1"><i class="fas fa-check-circle me-1"></i>Todos al día</span>`;
            }
            if (elListaResumenDeudores) {
                elListaResumenDeudores.innerHTML = "";
            }
            if (elProgresoBarra) {
                elProgresoBarra.style.width = "100%";
                elProgresoBarra.className = "progress-bar bg-success";
            }
        } else {
            elSaldoPendiente.innerText = `S/ ${saldoPendiente.toFixed(2)}`;
            elSaldoPendiente.className = "fw-bold fs-3 mt-1 text-center";
            elSaldoPendiente.style.color = "#d97706";

            let deudoresNombres = [];
            listaPendientes.forEach(item => {
                let nom = item.cliente.nombre + (item.cliente.ref ? ` (${item.cliente.ref})` : '');
                if (!deudoresNombres.includes(nom)) {
                    deudoresNombres.push(nom);
                }
            });

            if (elBadgeEstadoCobranza) {
                elBadgeEstadoCobranza.innerHTML = `<span class="badge rounded-pill px-2 py-1" style="background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a;"><i class="fas fa-exclamation-circle me-1"></i>${deudoresNombres.length} pendiente${deudoresNombres.length > 1 ? 's' : ''}</span>`;
            }

            if (elListaResumenDeudores) {
                elListaResumenDeudores.innerHTML = `<small class="d-block mt-2 text-muted fw-semibold" style="font-size: 0.78rem;"><strong class="text-dark">Falta:</strong> ${deudoresNombres.join(', ')}</small>`;
            }

            if (elProgresoBarra) {
                elProgresoBarra.style.width = `${porcentajeCobranza}%`;
                elProgresoBarra.className = "progress-bar bg-warning";
            }
        }
    }

    if (elProgresoTexto) {
        let unidad = totalClientesMes === 1 ? 'cuarto' : 'cuartos';
        elProgresoTexto.innerText = `${clientesAlDiaMes} de ${totalClientesMes} ${unidad} pagaron`;
    }

    // Renderizado Condicional de la Sección de Pendientes
    const secPendientes = document.getElementById('seccion-pendientes');
    const elListaPendientes = document.getElementById('lista-pendientes');
    const elTituloPendientes = document.getElementById('titulo-pendientes');

    if (listaPendientes.length > 0) {
        if (secPendientes) {
            secPendientes.classList.remove('d-none');
            secPendientes.style.display = 'block';
            secPendientes.className = 'mb-4';
        }
        if (elTituloPendientes) {
            elTituloPendientes.innerHTML = `<span class="text-warning"><i class="fas fa-hand-holding-usd me-1"></i></span> PENDIENTES DE COBRO (${listaPendientes.length})`;
            elTituloPendientes.style.color = "rgba(255, 255, 255, 0.85)";
        }
        if (elListaPendientes) {
            elListaPendientes.innerHTML = htmlPendientes;
        }
    } else {
        if (secPendientes) {
            secPendientes.classList.add('d-none');
            secPendientes.style.display = 'none';
        }
        if (elListaPendientes) {
            elListaPendientes.innerHTML = "";
        }
    }

    if (htmlPagados === "") htmlPagados = '<div class="text-center text-white-50 my-3 small"><i class="fas fa-info-circle me-1"></i>Aún no hay ingresos este mes.</div>';
    const elListaPagados = document.getElementById('lista-pagados');
    if (elListaPagados) {
        elListaPagados.innerHTML = htmlPagados;
    }
    let elListaEgresos = document.getElementById('lista-egresos');
    if (elListaEgresos) elListaEgresos.innerHTML = "";

    // Formatear mes en mayúsculas estricto ("OCTUBRE 2026")
    let nombreMesEspanol = (typeof meses !== 'undefined' && meses[mesVisualizado - 1]) 
        ? meses[mesVisualizado - 1].toUpperCase() 
        : `MES ${mesVisualizado}`;
    let textoMesDisplay = `${nombreMesEspanol} ${añoVisualizado}`;
    const elMesDisplay = document.getElementById('mes-actual-display');
    if (elMesDisplay) {
        elMesDisplay.innerText = textoMesDisplay;
    }

    // Bloqueo de mes futuro en la flecha de navegación
    const btnMesSiguiente = document.getElementById('btn-mes-siguiente');
    let esMesActualOSuperior = (añoVisualizado > añoActual) || (añoVisualizado === añoActual && mesVisualizado >= mesActual);
    if (btnMesSiguiente) {
        if (esMesActualOSuperior) {
            btnMesSiguiente.disabled = true;
            btnMesSiguiente.style.visibility = 'hidden';
            btnMesSiguiente.setAttribute('aria-hidden', 'true');
        } else {
            btnMesSiguiente.disabled = false;
            btnMesSiguiente.style.visibility = 'visible';
            btnMesSiguiente.removeAttribute('aria-hidden');
        }
    }
}

// --- ACCIONES PRINCIPALES ---
let modalInstancia = null;

function abrirModal(pagoId, nombre, monto) {
    document.getElementById('pago-id-actual').value = pagoId; // ID normal
    document.getElementById('msgConfirmacion').innerHTML = `¿Confirmas el pago de <strong>S/ ${parseFloat(monto).toFixed(2)}</strong> de <strong>${nombre}</strong>?`;
    if(!modalInstancia) modalInstancia = new bootstrap.Modal(document.getElementById('modalCobro'));
    modalInstancia.show();
}

function abrirModalGarantia(clienteId, nombre, monto) {
    document.getElementById('pago-id-actual').value = "GARANTIA_" + clienteId; // Truco para saber que es garantía
    document.getElementById('msgConfirmacion').innerHTML = `¿Confirmas el pago de la <strong>GARANTÍA (S/ ${parseFloat(monto).toFixed(2)})</strong> de <strong>${nombre}</strong>?`;
    if(!modalInstancia) modalInstancia = new bootstrap.Modal(document.getElementById('modalCobro'));
    modalInstancia.show();
}

function procesarPago(accionPosterior = false) {
    let pagoIdVal = document.getElementById('pago-id-actual').value;
    let metodo = document.querySelector('input[name="metodo_pago"]:checked').value;
    let pagoGeneradoOActualizadoId = null;
    let timestampExacto = formatearFechaHora(Date.now());
    let codigoRecibo = "REC-" + Date.now().toString().slice(-6);
    
    // Si el valor empieza con GARANTIA_
    if (String(pagoIdVal).startsWith("GARANTIA_")) {
        let cliId = parseInt(pagoIdVal.split("_")[1]);
        let clientes = JSON.parse(localStorage.getItem('aldia_clientes'));
        let cliente = clientes.find(c => c.id === cliId);
        
        if (cliente) {
            cliente.garantia_pagada = true; // Actualizamos su perfil
            localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
            
            let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
            let nuevoPagoId = Date.now();
            pagos.push({
                id: nuevoPagoId,
                fecha_pago_real: Date.now(),
                cliente_id: cliente.id,
                mes: mesActual,
                año: añoActual,
                monto: cliente.garantia_monto,
                pagado: true,
                metodo: metodo,
                historico: `${cliente.nombre} (Garantía)`.trim(),
                es_garantia: true,
                id_recibo: codigoRecibo,
                fecha_emision: timestampExacto
            });
            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
            pagoGeneradoOActualizadoId = nuevoPagoId;
        }
    } else if (String(pagoIdVal).startsWith("CREAR_")) {
        // Registro dinámico desde botón de lista pendiente
        let partes = String(pagoIdVal).split("_");
        let cliId = parseInt(partes[1]);
        let m = parseInt(partes[2]) || mesVisualizado;
        let y = parseInt(partes[3]) || añoVisualizado;
        let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
        let cliente = clientes.find(c => c.id === cliId);
        if (cliente) {
            let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
            let nuevoPagoId = Date.now();
            pagos.push({
                id: nuevoPagoId,
                cliente_id: cliId,
                mes: m,
                año: y,
                monto: cliente.monto,
                pagado: true,
                metodo: metodo,
                fecha_pago_real: Date.now(),
                historico: `${cliente.nombre} ${cliente.apellido || ''}`.trim(),
                id_recibo: codigoRecibo,
                fecha_emision: timestampExacto
            });
            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
            pagoGeneradoOActualizadoId = nuevoPagoId;
        }
    } else {
        // Es un pago mensual normal
        let pagoId = parseInt(pagoIdVal);
        let pagos = JSON.parse(localStorage.getItem('aldia_pagos'));
        let index = pagos.findIndex(p => p.id === pagoId);
        if(index !== -1) {
            pagos[index].pagado = true;
            pagos[index].metodo = metodo;
            pagos[index].fecha_pago_real = Date.now();
            pagos[index].id_recibo = pagos[index].id_recibo || codigoRecibo;
            pagos[index].fecha_emision = pagos[index].fecha_emision || timestampExacto;
            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
            pagoGeneradoOActualizadoId = pagoId;
        }
    }
    
    modalInstancia.hide();
    renderizarDashboard();

    if (pagoGeneradoOActualizadoId && accionPosterior === 'pdf') {
        generarReciboPDF(pagoGeneradoOActualizadoId);
    }
}

// --- V3: ENVIAR COMPROBANTE POR WHATSAPP (Opción A: Texto Formateado) ---
function abrirEnlaceWhatsApp(url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
    }, 200);
}

function enviarComprobanteWhatsApp(pagoId) {
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    
    let pago = pagos.find(p => p.id === pagoId);
    if (!pago) {
        alert("No se encontró la información del pago.");
        return;
    }

    let cliente = clientes.find(c => c.id === pago.cliente_id);
    let nombreCliente = cliente 
        ? `${cliente.nombre} ${cliente.apellido || ''}`.trim() 
        : (pago.historico || 'Inquilino');
    let refCliente = (cliente && cliente.ref) ? cliente.ref : (pago.es_garantia ? 'Garantía' : 'Alquiler');

    let concepto = "";
    if (pago.es_garantia) {
        concepto = "Depósito de Garantía";
    } else if (cliente && cliente.tipo_servicio && cliente.tipo_servicio !== 'alquiler') {
        let nombreServ = cliente.tipo_servicio.charAt(0).toUpperCase() + cliente.tipo_servicio.slice(1);
        let mesTexto = (typeof meses !== 'undefined' && meses[pago.mes - 1]) ? meses[pago.mes - 1] : `Mes ${pago.mes}`;
        concepto = `${nombreServ} - ${mesTexto} ${pago.año}`;
    } else {
        let mesTexto = (typeof meses !== 'undefined' && meses[pago.mes - 1]) ? meses[pago.mes - 1] : `Mes ${pago.mes}`;
        concepto = `Alquiler - ${mesTexto} ${pago.año}`;
    }

    let fechaPago = pago.fecha_pago_real ? new Date(Number(pago.fecha_pago_real)) : new Date(Number(pago.id));
    if (isNaN(fechaPago.getTime())) fechaPago = new Date();
    let fechaHoraStr = formatearFechaHora(fechaPago);

    let nroRecibo = pago.id_recibo;
    if (!nroRecibo) {
        nroRecibo = "REC-" + String(pago.id).slice(-6);
        pago.id_recibo = nroRecibo;
        let pIdx = pagos.findIndex(p => Number(p.id) === Number(pagoId));
        if (pIdx !== -1) {
            pagos[pIdx].id_recibo = nroRecibo;
            if (!pagos[pIdx].fecha_emision) {
                pagos[pIdx].fecha_emision = fechaHoraStr;
            }
            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
        }
    }

    let mensaje = 
`🏠 *AL-DIA - COMPROBANTE DE PAGO*
━━━━━━━━━━━━━━━━━━━━━━━
🧾 *N° Recibo:* ${nroRecibo}
👤 *Inquilino:* ${nombreCliente}
🚪 *Referencia:* ${refCliente}
📅 *Fecha:* ${fechaHoraStr}
📌 *Concepto:* ${concepto}
💵 *Monto:* S/ ${parseFloat(pago.monto || 0).toFixed(2)}
💳 *Método:* ${pago.metodo || 'Efectivo'}
━━━━━━━━━━━━━━━━━━━━━━━
✅ *Estado:* PAGADO / CONFORME
¡Muchas gracias por su puntualidad!`;

    let telefono = cliente ? (cliente.telefono || '') : '';
    let cleanPhone = String(telefono).replace(/\D/g, '');

    if (!cleanPhone) {
        let telPrompt = prompt(`El inquilino ${nombreCliente} no tiene número de WhatsApp registrado.\n\nIngresa su número (ej. 987654321) para guardarlo y enviar el comprobante, o presiona Cancelar para elegir el contacto directamente en WhatsApp:`, "");
        if (telPrompt !== null && telPrompt.trim() !== "") {
            cleanPhone = telPrompt.replace(/\D/g, '');
            if (cliente) {
                cliente.telefono = telPrompt.trim();
                localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
            }
        }
    }

    if (cleanPhone && cleanPhone.length === 9) {
        cleanPhone = '51' + cleanPhone;
    }

    let urlWhatsApp = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(mensaje)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    abrirEnlaceWhatsApp(urlWhatsApp);
}

// --- V3: ENVIAR RECORDATORIO DE PAGO POR WHATSAPP ---
function enviarRecordatorioWhatsApp(clienteId, pagoId) {
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) {
        alert("No se encontró la información del inquilino.");
        return;
    }

    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let pago = pagoId ? pagos.find(p => p.id === pagoId) : pagos.find(p => p.cliente_id === clienteId && !p.pagado && p.mes === mesVisualizado && p.año === añoVisualizado);

    let montoDeuda = pago ? pago.monto : cliente.monto;
    let mesTexto = (typeof meses !== 'undefined' && meses[mesVisualizado - 1]) ? meses[mesVisualizado - 1] : `Mes ${mesVisualizado}`;
    let concepto = (cliente.tipo_servicio && cliente.tipo_servicio !== 'alquiler')
        ? `${cliente.tipo_servicio.charAt(0).toUpperCase() + cliente.tipo_servicio.slice(1)} - ${mesTexto} ${añoVisualizado}`
        : `Alquiler - ${mesTexto} ${añoVisualizado}`;

    let refCliente = cliente.ref || 'Habitación/Servicio';
    let diaCobro = cliente.dia || 1;

    let mensaje = 
`🏠 *AL-DIA - RECORDATORIO DE PAGO*
━━━━━━━━━━━━━━━━━━━━━━━
Hola *${cliente.nombre}*, le saludamos cordialmente para recordarle su pago pendiente:
📌 *Concepto:* ${concepto}
🚪 *Referencia:* ${refCliente}
💵 *Monto Pendiente:* S/ ${parseFloat(montoDeuda || 0).toFixed(2)}
📅 *Día de Cobro:* ${diaCobro} de ${mesTexto}
━━━━━━━━━━━━━━━━━━━━━━━
Agradecemos gestionar su pago a la brevedad.
¡Muchas gracias por su atención!`;

    let telefono = cliente.telefono || '';
    let cleanPhone = String(telefono).replace(/\D/g, '');

    if (!cleanPhone) {
        let telPrompt = prompt(`El inquilino ${cliente.nombre} no tiene número de WhatsApp registrado.\n\nIngresa su número (ej. 987654321) para guardarlo y enviar el recordatorio, o presiona Cancelar para elegir el contacto directamente en WhatsApp:`, "");
        if (telPrompt !== null && telPrompt.trim() !== "") {
            cleanPhone = telPrompt.replace(/\D/g, '');
            cliente.telefono = telPrompt.trim();
            localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
        }
    }

    if (cleanPhone && cleanPhone.length === 9) {
        cleanPhone = '51' + cleanPhone;
    }

    let urlWhatsApp = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(mensaje)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    abrirEnlaceWhatsApp(urlWhatsApp);
}

// --- V3: ENVIAR RECORDATORIO DE GARANTÍA POR WHATSAPP ---
function enviarRecordatorioGarantiaWhatsApp(clienteId) {
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    let refCliente = cliente.ref || 'Habitación';
    let fechaGar = cliente.garantia_fecha || '';
    let [anioGar, mesGar, diaGar] = fechaGar ? fechaGar.split('-').map(Number) : [null, null, null];
    let fechaTexto = diaGar ? `${diaGar} de ${(typeof meses !== 'undefined' && meses[mesGar - 1]) ? meses[mesGar - 1] : mesGar} ${anioGar}` : 'Pendiente';

    let mensaje = 
`🏠 *AL-DIA - RECORDATORIO DE GARANTÍA*
━━━━━━━━━━━━━━━━━━━━━━━
Hola *${cliente.nombre}*, le saludamos cordialmente para recordarle el depósito de garantía pendiente:
📌 *Concepto:* Depósito de Garantía
🚪 *Referencia:* ${refCliente}
💵 *Monto:* S/ ${parseFloat(cliente.garantia_monto || 0).toFixed(2)}
📅 *Fecha Acordada:* ${fechaTexto}
━━━━━━━━━━━━━━━━━━━━━━━
Agradecemos coordinar la regularización de la garantía.
¡Muchas gracias!`;

    let telefono = cliente.telefono || '';
    let cleanPhone = String(telefono).replace(/\D/g, '');

    if (!cleanPhone) {
        let telPrompt = prompt(`El inquilino ${cliente.nombre} no tiene número de WhatsApp registrado.\n\nIngresa su número (ej. 987654321) para guardarlo y enviar el recordatorio, o presiona Cancelar para elegir el contacto directamente en WhatsApp:`, "");
        if (telPrompt !== null && telPrompt.trim() !== "") {
            cleanPhone = telPrompt.replace(/\D/g, '');
            cliente.telefono = telPrompt.trim();
            localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
        }
    }

    if (cleanPhone && cleanPhone.length === 9) {
        cleanPhone = '51' + cleanPhone;
    }

    let urlWhatsApp = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(mensaje)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    abrirEnlaceWhatsApp(urlWhatsApp);
}

window.enviarComprobanteWhatsApp = enviarComprobanteWhatsApp;
window.enviarRecordatorioWhatsApp = enviarRecordatorioWhatsApp;
window.enviarRecordatorioGarantiaWhatsApp = enviarRecordatorioGarantiaWhatsApp;

// ==========================================================================
// --- V3: MOTOR DE COMPROBANTES PDF E ID ÚNICO (generarReciboPDF) ---
// ==========================================================================
function generarReciboPDF(pagoId) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("La librería jsPDF no está disponible. Por favor recarga la aplicación.");
        return;
    }

    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];

    let pago = pagos.find(p => Number(p.id) === Number(pagoId));
    if (!pago) {
        alert("No se encontró la información del pago.");
        return;
    }

    let cliente = clientes.find(c => Number(c.id) === Number(pago.cliente_id));

    // 1. Trazabilidad: código único inmutable y fecha de emisión exacta
    let idRecibo = pago.id_recibo;
    if (!idRecibo) {
        idRecibo = "REC-" + String(pago.id).slice(-6);
        pago.id_recibo = idRecibo;
    }

    let fechaEmision = obtenerFechaEmisionInmutable(pago);
    pago.fecha_emision = fechaEmision;

    // Persistir si no estaban guardados en el objeto para garantizar inmutabilidad
    let pIdx = pagos.findIndex(p => Number(p.id) === Number(pagoId));
    if (pIdx !== -1 && (!pagos[pIdx].id_recibo || !pagos[pIdx].fecha_emision)) {
        pagos[pIdx].id_recibo = idRecibo;
        pagos[pIdx].fecha_emision = fechaEmision;
        localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
    }

    // 2. Extracción y formateo estructurado de datos
    let nombreInquilino = cliente 
        ? `${cliente.nombre} ${cliente.apellido || ''}`.trim() 
        : (pago.historico || 'Inquilino');

    let refInquilino = (cliente && cliente.ref) 
        ? cliente.ref 
        : (pago.es_garantia ? 'Garantía' : 'Habitación / Referencia');

    let mesTexto = (typeof meses !== 'undefined' && meses[pago.mes - 1]) 
        ? meses[pago.mes - 1] 
        : `Mes ${pago.mes}`;

    let concepto = "";
    if (pago.es_garantia) {
        concepto = "Depósito de Garantía";
    } else if (cliente && cliente.tipo_servicio && cliente.tipo_servicio !== 'alquiler') {
        let nombreServ = cliente.tipo_servicio.charAt(0).toUpperCase() + cliente.tipo_servicio.slice(1);
        concepto = `${nombreServ} - ${mesTexto} ${pago.año}`;
    } else {
        concepto = `Alquiler - ${mesTexto} ${pago.año}`;
    }

    let fechaVencimiento = pago.fecha_vencimiento;
    if (!fechaVencimiento) {
        if (cliente && cliente.dia) {
            let diaPad = String(cliente.dia).padStart(2, '0');
            let mesPad = String(pago.mes || mesActual).padStart(2, '0');
            fechaVencimiento = `${diaPad}/${mesPad}/${pago.año || añoActual}`;
        } else if (pago.dia) {
            let diaPad = String(pago.dia).padStart(2, '0');
            let mesPad = String(pago.mes || mesActual).padStart(2, '0');
            fechaVencimiento = `${diaPad}/${mesPad}/${pago.año || añoActual}`;
        } else {
            fechaVencimiento = `${mesTexto} ${pago.año}`;
        }
    } else {
        fechaVencimiento = formatearFechaCorta(fechaVencimiento);
    }

    // 3. Renderizado con jsPDF (Corrección Milimétrica: Orden de Renderizado, Inmutabilidad, Fechas y UX)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;

    const marginX = 20;
    const startY = 20;
    const cardWidth = pageWidth - 2 * marginX; // 170 mm
    const cardHeight = 150; // Altura milimétrica optimizada

    // Logotipo Base64 (Preservado)
    const logoBase64 = "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lIB5CBAgQIAAAQIECBAgQIAAgfIFdEiAAAEC6QoImKS7NiojQIAAAQIECOQmoF4CBAgQIECAAAECBAgQIECgfAEdEiBAgAABAh0VEDDp6MJrmwABAgS6KqBvAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIECBCoXkDApHpTIxIgQGAwAVcTIECAAAECBAgQIECAAAEC5QvokAABAgQIECBAgAABApkJCJhktmDKTUNAFQQIECBAgAABAgQIECBAgED5AjokQIAAAQIECBAgQIAAAQIENgmUGjDZ1KFnBAgQIECAAAECBAgQIECAQKkC+iJAgAABAgQIECBAgAABAgTKF9BhIgICJokshDIIECBAgAABAgQIECBQpoCuCBAgQIAAAQIECBAgQIAAgfIFdEiAQBcEBEy6sMp6JECAAAECBAgQIDCWgM8IECBAgAABAgQIECBAgACB8gV0SIAAAQIEBhQQMBkQ0OUECBAgQIAAgSYEzEGAAAECBAgQIECAAAECBAiUL6BDAgQIECBAgEDKAgImKa+O2ggQIEAgJwG1EiBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIBAZwUETDq79Bon0EUBPRMgQIAAAQIECBAgQIAAAQLlC+iQAAECBAgQIECAAAECBOoQEDCpQ9WYExdwJQECBAgQIECAAAECBAgQIFC+gA4JECBAgAABAgQIECBAgACB7AT6Dphk16GCCRAgQIAAAQIECBAgQIAAgb4FXECAAAECBAgQIECAAAECBAiUL6BDAv0ICJj0o+VcAgQIECBAgAABAgQIpCOgEgIECBAgQIAAAQIECBAgQKB8AR0SIEAgGQEBk2SWQiEECBAgQIAAAQLlCeiIAAECBAgQIECAAAECBAgQKF9AhwQIECBAoBsCAibdWGddEiBAgAABAqMJeJ8AAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAAECAwsImAxMaAACBAgQqFvA+AQIECBAgAABAgQIECBAgED5AjokQIAAAQIECBAgQCBtAQGTtNdHdQRyEVAnAQIECBAgQIAAAQIECBAgUL6ADgkQIECAAAECBAgQIECgwwICJp1ZfI0SIECAAAECBAgQIECAAAEC5QvokAABAgQIECBAgAABAgQIEChfoJ0OBUzacTcrAQIECBAgQIAAAQIECHRVQN8ECBAgQIAAAQIECBAgQIBA+QI6JFCggIBJgYuqJQIECBAgQIAAAQIEBhNwNQECBAgQIECAAAECBAgQIFC+gA4JECBAoD8BAZP+vJxNgAABAgQIECCQhoAqCBAgQIAAAQIECBAgQIAAgfIFdEiAAAECBAgkJCBgktBiKIUAAQIECJQloBsCBAgQIECAAAECBAgQIECgfAEdEiBAgAABAgQIdEVAwKQrK61PAgQIjCTgPQIECBAgQIAAAQIECBAgQKB8AR0SIECAAAECBAgQIECgAgEBkwoQDUGgTgFjEyBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIAAAQIECKQuIGAy+AoZgQABAgQIECBAgAABAgQIEChfQIcECBAgQIAAAQIECBAgQIBA+QI6HENAwGQMHB8RIECAAAECBAgQIECAQE4CaiVAgAABAgQIECBAgAABAgTKF9AhAQJtCQiYtCVvXgIECBAgQIAAAQJdFNAzAQIECBAgQIAAAQIECBAgUL6ADgkQIECgSAEBkyKXVVMECBAgQIAAgYkLuJIAAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAIF+BQRM+hVzPgECBAgQaF9ABQQIECBAgAABAgQIECBAgED5AjokQIAAAQIECBAgkJSAgElSy6EYAgTKEdAJAQIECBAgQIAAAQIECBAgUL6ADgkQIECAAAECBAgQINAdAQGT7qy1TrcU8JoAAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAAECBAgQIECAQCUCSQdMKunQIAQIECBAgAABAgQIECBAgEDSAoojQIAAAQIECBAgQIAAAQIEyhfQYf4CAib5r6EOCBAgQIAAAQIECBAgULeA8QkQIECAAAECBAgQIECAAIHyBXRIgACBMQUETMbk8SEBAgQIECBAgACBXATUSYAAAQIECBAgQIAAAQIECJQvoEMCBAgQINCegIBJe/ZmJkCAAAECBLomoF8CBAgQIECAAAECBAgQIECgfAEdEiBAgAABAgQKFRAwKXRhtUWAAAECExNwFQECBAgQIECAAAECBAgQIFC+gA4JECBAgAABAgQIEOhfQMCkfzNXECDQroDZCRAgQIAAAQIECBAgQIAAgfIFdEiAAAECBAgQIECAAAECiQkImCS2IGWUowsCBAgQIECAAAECBAgQIECgfAEdEiBAgAABAgQIECBAgAABAuULbOpQwGSThWcECBAgQIAAAQIECBAgQKAsAd0QIECAAAECBAgQIECAAAEC5QvokEBDAgImDUGbhgABAgQIECBAgAABAiMJeI8AAQIECBAgQIAAAQIECBAoX0CHBAgQKEFAwKSEVdQDAQIECBAgQIBAnQLGJkCAAAECBAgQIECAAAECBMoX0CEBAgQIECAwjoCAyThAPiZAgAABAgRyEFAjAQIECBAgQIAAAQIECBAgUL6ADgkQIECAAAECBNoUEDBpU9/cBAgQ6JKAXgkQIECAAAECBAgQIECAAIHyBXRIgAABAgQIECBAgECxAgImxS6txgj0L+AKAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIECBAgQIAAgYkICJhMRK29a8xMgAABAgQIECBAgAABAgQIlC+gQwIECBAgQIAAAQIECBAgQKB8gew6FDDJbskUTIAAAQIECBAgQIAAAQLtC6iAAAECBAgQIECAAAECBAgQKF9AhwQIbC4gYLK5hucECBAgQIAAAQIECJQjoBMCBAgQIECAAAECBAgQIECgfAEdEiBAgEBjAgImjVGbiAABAgQIECBAYEsBrwkQIECAAAECBAgQIECAAIHyBXRIgAABAgQIlCEgYFLGOuqCAAECBAjUJWBcAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIECBAYV0DAZFwiJxAgQCB1AfURIECApnwTvwAAEABJREFUAAECBAgQIECAAAEC5QvokAABAgQIECBAgAABAu0KCJi062/2rgjokwABAgQIECBAgAABAgQIEChfQIcECBAgQIAAAQIECBAgQKBgAQGTpxfXAwECBAgQIECAAAECBAgQIFC+gA4JECBAgAABAgQIECBAgACB8gV0WI+AgEk9rkYlQIAAAQIECBAgQIAAgYkJuIoAAQIECBAgQIAAAQIECBAoX0CHBAhkKCBgkuGiKZkAAQIECBAgQIBAuwJmJ0CAAAECBAgQIECAAAECBMoX0CEBAgQIEHi2gIDJsz28IkCAAAECBAiUIaALAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIEGhQQMGkQ21QECBAgQGBzAc8JECBAgAABAgQIECBAgACB8gV0SIAAAQIECBAgQKAUAQGTUlZSHwQI1CFgTAIECBAgQIAAAQIECBAgQKB8AR0SIECAAAECBAgQIECAQA8CAiY9IDklZQG1ESBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIAAAQIECBBoW6D+gEnbHZqfAAECBAgQIECAAAECBAgQqF/ADAQIECBAgAABAgQIECBAgED5AjrstICASaeXX/MECBAgQIAAAQIECHRJQK8ECBAgQIAAAQIECBAgQIBA+QI6JECAQF0CAiZ1yRqXAAECBAgQIECAQP8CriBAgAABAgQIECBAgAABAgTKF9AhAQIECBDIUkDAJMtlUzQBAgQIECDQnoCZCRAgQIAAAQIECBAgQIAAgfIFdEiAAAECBAgQILClgIDJliJeEyBAgED+AjogQIAAAQIECBAgQIAAAQIEyhfQIQECBAgQIECAAAECjQoImDTKbTICBIYFPBIgQIAAAQIECBAgQIAAAQLlC+iQAAECBAgQIECAAAECBMoREDApZy2r7sR4BAgQIECAAAECBAgQIECAQPkCOiRAgAABAgQIECBAgAABAgTKF6ikQwGTShgNQoAAAQIECBAgQIAAAQIE6hIwLgECBAgQIECAAAECBAgQIFC+gA4JpC8gYJL+GqmQAAECBAgQIECAAIHUBdRHgAABAgQIECBAgAABAgQIlC+gQwIECHRcQMCk418A7RMgQIAAAQIEuiKgTwIECBAgQIAAAQIECBAgQKB8AR0SIECAAAEC9QkImNRna2QCBAgQIECgPwFnEyBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQCBTAQGTTBdO2QQIEGhHwKwECBAgQIAAAQIECBAgQIBA+QI6JECAAAECBAgQIECAwNYCAiZbm3iHQN4CqidAgAABAgQIECBAgAABAgTKF9AhAQIECBAgQIAAAQIECBBoWEDApGHwOJ2DAAECBAgQIECAAAECBAgQKF9AhwQIECBAgAABAgQIECBAgED5Al3qUMCkS6utVwIECBAgQIAAAQIECBDYXMBzAgQIECBAgAABAgQIECBAoHwBHRIgUJGAgElFkIYhQIAAAQIECBAgQKAOAWMSIECAAAECBAgQIECAAAEC5QvokAABAgRyEBAwyWGV1EiAAAECBAgQSFlAbQQIECBAgAABAgQIECBAgED5AjokQIAAAQIEOi8gYNL5rwAAAgQIEOiCgB4JECBAgAABAgQIECBAgACB8gV0SIAAAQIECBAgQKBOAQGTOnWNTYAAgd4FnEmAAAECBAgQIECAAAECBAiUL6BDAgQIECBAgAABAgQIZCsgYJLt0im8eQEzEiBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIAAAQIECBAYSaCsgMlIHXqPAAECBAgQIECAAAECBAgQKEtANwQIECBAgAABAgQIECBAgED5AjpMTkDAJLklURABAgQIECBAgAABAgTyF9ABAQIECBAgQIAAAQIECBAgUL6ADgkQ6JaAgEm31lu3BAgQIECAAAECBIYFPBIgQIAAAQIECBAgQIAAAQLlC+iQAAECBAhUJiBgUhmlgQgQIECAAAECVQsYjwABAgQIECBAgAABAgQIEChfQIcECBAgQIAAgTwEBEzyWCdVEiBAgECqAuoiQIAAAQIECBAgQIAAAQIEyhfQIQECBAgQIECAAAECQcDEl4AAgeIFNEiAAAECBAgQIECAAAECBAiUL6BDAgQIECBAgAABAgQIEKhXQMCkXl+j9ybgLAIECBAgQIAAAQIECBAgQKB8AR0SIECAAAECBAgQIECAAAECGQv0GDDJuEOlEyBAgAABAgQIECBAgAABAj0KOI0AAQIECBAgQIAAAQIECBAoX0CHBCYmIGAyMTdXESBAgAABAgQIECBAoB0BsxIgQIAAAQIECBAgQIAAAQLlC+iQAAECCQoImCS4KEoiQIAAAQIECBDIW0D1BAgQIECAAAECBAgQIECAQPkCOiRAgAABAl0TEDDp2orrlwABAgQIEIgCDgIECBAgQIAAAQIECBAgQKB8AR0SIECAAAECBAhUKCBgUiGmoQgQIECgSgFjESBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIAAgVwEBExyWSl1EkhRQE0ECBAgQIAAAQIECBAgQIBA+QI6JECAAAECBAgQIECAAAEC6wUETNYjlPxfvREgQIAAAQIECBAgQIAAAQLlC+iQAAECBAgQIECAAAECBAgQKF+g7Q4FTNpeAfMTIECAAAECBAgQIECAQBcE9EiAAAECBAgQIECAAAECBAiUL6BDAkULCJgUvbyaI0CAAAECBAgQIECgdwFnEiBAgAABAgQIECBAgAABAuUL6JAAAQIEJiogYDJROdcRIECAAAECBAg0L2BGAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQJJCgiYJLksiiJAgAABAvkKqJwAAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAAEC3RMQMOnemuuYAAECBAgQIECAAAECBAgQIECAAIHyBXRIgAABAgQIECBAgACBSgUETCrlNBiBqgSMQ4AAAQIECBAgQIAAAQIECJQvoEMCBAgQIECAAAECBAgQIJCPgIDJRNfKdQQIECBAgAABAgQIECBAgED5AjokQIAAAQIECBAgQIAAAQIEyhfQYU8CAiY9MTmJAAECBAgQIECAAAECBFIVUBcBAgQIECBAgAABAgQIECBQvoAOCRBoX0DApP01UAEBAgQIECBAgACB0gX0R4AAAQIECBAgQIAAAQIECJQvoEMCBAgQKFxAwKTwBdYeAQIECBAgQKA3AWcRIECAAAECBAgQIECAAAEC5QvokAABAgQIECAwcQEBk4nbuZIAAQIECDQrYDYCBAgQIECAAAECBAgQIECgfAEdEiBAgAABAgQIEEhUQMAk0YVRFgECeQqomgABAgQIECBAgAABAgQIEChfQIcECBAgQIAAAQIECBDoooCASRdXvds9654AAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAAECBAgQIECAQMUCCQZMKu7QcAQIECBAgAABAgQIECBAgECCAkoiQIAAAQIECBAgQIAAAQIEyhfQYUkCAiYlraZeCBAgQIAAAQIECBAgUKWAsQgQIECAAAECBAgQIECAAIHyBXRIgACBHgUETHqEchoBAgQIECBAgACBFAXURIAAAQIECBAgQIAAAQIECJQvoEMCBAgQIJCCgIBJCqugBgIECBAgQKBkAb0RIECAAAECBAgQIECAAAEC5QvokAABAgQIECBQvICASfFLrEECBAgQGF/AGQQIECBAgAABAgQIECBAgED5AjokQIAAAQIECBAgQGAQAQGTQfRcS4BAcwJmIkCAAAECBAgQIECAAAECBMoX0CEBAgQIECBAgAABAgQIJCsgYJLs0uRXmIoJECBAgAABAgQIECBAgACB8gV0SIAAAQIECBAgQIAAAQIECJQvMFKHAiYjqXiPAAECBAgQIECAAAECBAjkK6ByAgQIECBAgAABAgQIECBAoHwBHRJoXEDApHFyExIgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgUL6ADgkQIFCWgIBJWeupGwIECBAgQIAAgaoEjEOAAAECBAgQIECAAAECBAiUL6BDAgQIECBAoGcBAZOeqZxIgAABAgQIpCagHgIECBAgQIAAAQIECBAgQKB8AR0SIECAAAECBAikISBgksY6qIIAAQKlCuiLAAECBAgQIECAAAECBAgQKF9AhwQIECBAgAABAgQIdEBAwKQDi6xFAmML+JQAAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAAECBAgQIEBgMAEBk8H8mrnaLAQIECBAgAABAgQIECBAgED5AjokQIAAAQIECBAgQIAAAQIEyhfIuEMBk4wXT+kECBAgQIAAAQIECBAg0KyA2QgQIECAAAECBAgQIECAAIHyBXRIgMDIAgImI7t4lwABAgQIECBAgACBPAVUTYAAAQIECBAgQIAAAQIECJQvoEMCBAgQaEFAwKQFdFMSIECAAAECBLotoHsCBAgQIECAAAECBAgQIECgfAEdEiBAgAABAqUJCJiUtqL6IUCAAAECVQgYgwABAgQIECBAgAABAgQIEChfQIcECBAgQIAAAQIE+hAQMOkDy6kECBBISUAtBAgQIECAAAECBAgQIECAQPkCOiRAgAABAgQIECBAgEAqAgImqayEOkoU0BMBAgQIECBAgAABAgQIECBQvoAOCRAgQIAAAQIECBAgQIBAJwQ6HjDpxBprkgABAgQIECBAgAABAgQIdFxA+wQIECBAgAABAgQIECBAgED5AjqsW0DApG5h4xMgQIAAAQIECBAgQIDA+ALOIECAAAECBAgQIECAAAECBMoX0CEBAlkLCJhkvXyKJ0CAAAECBAgQINCcgJkIECBAgAABAgQIECBAgACB8gV0SIAAAQIERhMQMBlNxvsECBAgQIAAgfwEVEyAAAECBAgQIECAAAECBAiUL6BDAgQIECBAgEArAgImrbCblAABAgS6K6BzAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIECBAoT0DApLw11REBAoMKuJ4AAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAAECBAgQINCXgIBJX1xOTkVAHQQIECBAgAABAgQIECBAgED5AjokQIAAAQIECBAgQIAAAQIE0hGoK2CSTocqIUCAAAECBAgQIECAAAECBOoSMC4BAgQIECBAgAABAgQIECBQvoAOCWwQEDDZwOAHAQIECBAgQIAAAQIEShXQFwECBAgQIECAAAECBAgQIFC+gA4JECBQv4CASf3GZiBAgAABAgQIECAwtoBPCRAgQIAAAQIECBAgQIAAgfIFdEiAAAECBDIXEDDJfAGVT4AAAQIECDQjYBYCBAgQIECAAAECBAgQIECgfAEdEiBAgAABAgQIjC4gYDK6jU8IECBAIC8B1RIgQIAAAQIECBAgQIAAAQLlC+iQAAECBAgQIECAAIGWBC/E3r0AABAASURBVARMWoI3LYFuCuiaAAECBAgQIECAAAECBAgQKF9AhwQIECBAgAABAgQIECBQooCASYmrOkhPriVAgAABAgQIECBAgAABAgTKF9AhAQIECBAgQIAAAQIECBAgUL5AxR0KmFQMajgCBAgQIECAAAECBAgQIFCFgDEIECBAgAABAgQIECBAgACB8gV0SCAnAQGTnFZLrQQIECBAgAABAgQIpCSgFgIECBAgQIAAAQIECBAgQKB8AR0SIECAwNMCAiZPQ3ggQIAAAQIECBAoUUBPBAgQIECAAAECBAgQIECAQPkCOiRAgAABAgSaEBAwaULZHAQIECBAgMDoAj4hQIAAAQIECBAgQIAAAQIEyhfQIQECBAgQIECAQPYCAibZL6EGCBAgUL+AGQgQIECAAAECBAgQIECAAIHyBXRIgAABAgQIECBAgACBsQQETMbS8RmBfARUSoAAAQIECBAgQIAAAQIECJQvoEMCBAgQIECAAAECBAgQINCagIBJY/QmIkCAAAECBAgQIECAAAECBMoX0CEBAgQIECBAgAABAgQIECBQvkA3OxQw6ea665oAAQIECBAgQIAAAQLdFdA5AQIECBAgQIAAAQIECBAgUL6ADgkQqFxAwKRyUgMSIECAAAECBAgQIDCogOsJECBAgAABAgQIECBAgACB8gV0SIAAAQJ5CQiY5LVeqiVAgAABAgQIpCKgDgIECBAgQIAAAQIECBAgQKB8AR0SIECAAAECBJ4REDB5hsITAgQIECBQmoB+CBAgQIAAAQIECBAgQIAAgfIFdEiAAAECBAgQIECgGQEBk2aczUKAAIGRBbxLgAABAgQIECBAgAABAgQIlC+gQwIECBAgQIAAAQIECBQgIGBSwCJqoV4BoxMgQIAAAQIECBAgQIAAAQLlC+iQAAECBAgQIECAAAECBAgQGFughIDJ2B36lAABAgQIECBAgAABAgQIEChBQA8ECBAgQIAAAQIECBAgQIBA+QI6TFhAwCThxVEaAQIECBAgQIAAAQIE8hJQLQECBAgQIECAAAECBAgQIFC+gA4JEOiqgIBJV1de3wQIECBAgAABAt0U0DUBAgQIECBAgAABAgQIECBQvoAOCRAgQIBADQICJjWgGpIAAQIECBAgMIiAawkQIECAAAECBAgQIECAAIHyBXRIgAABAgQIEMhNQMAktxVTLwECBAikIKAGAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIECBAgsJmAgMlmGJ4SIFCSgF4IECBAgAABAgQIECBAgACB8gV0SIAAAQIECBAgQIAAAQJNCQiYNCVtnq0FvEOAAAECBAgQIECAAAECBAiUL6BDAgQIECBAgAABAgQIECBAoAiBMQMmRXSoCQIECBAgQIAAAQIECBAgQGBMAR8SIECAAAECBAgQIECAAAEC5QvokMCgAgImgwq6ngABAgQIECBAgAABAvULmIEAAQIECBAgQIAAAQIECBAoX0CHBAgQSFpAwCTp5VEcAQIECBAgQIBAPgIqJUCAAAECBAgQIECAAAECBMoX0CEBAgQIEOiugIBJd9de5wQIECBAoHsCOiZAgAABAgQIECBAgAABAgTKF9AhAQIECBAgQIBALQICJrWwGpQAAQIEJirgOgIECBAgQIAAAQIECBAgQKB8AR0SIECAAAECBAgQIJCfgIBJfmumYgJtC5ifAAECBAgQIECAAAECBAgQKF9AhwQIECBAgAABAgQIECBA4FkCAibP4ijlhT4IECBAgAABAgQIECBAgACB8gV0SIAAAQIECBAgQIAAAQIECJQvkE6HAibprIVKCBAgQIAAAQIECBAgQKA0Af0QIECAAAECBAgQIECAAAEC5QvokEBHBARMOrLQ2iRAgAABAgQIECBAYGQB7xIgQIAAAQIECBAgQIAAAQLlC+iQAAECBAYXEDAZ3NAIBAgQIECAAAEC9QoYnQABAgQIECBAgAABAgQIEChfQIcECBAgQIBA4gICJokvkPIIECBAgEAeAqokQIAAAQIECBAgQIAAAQIEyhfQIQECBAgQIECAQJcFBEy6vPp6J0CgWwK6JUCAAAECBAgQIECAAAECBMoX0CEBAgQIECBAgAABAgRqEhAwqQnWsAQmIuAaAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIECBAgQIAAgRwFBEz6WzVnEyBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIAAAQIECBAoX0CHfQoImPQJ5nQCBAgQIECAAAECBAgQSEFADQQIECBAgAABAgQIECBAgED5AjokQCAlAQGTlFZDLQQIECBAgAABAgRKEtALAQIECBAgQIAAAQIECBAgUL6ADgkQIECgMwICJp1Zao0SIECAAAECBLYW8A4BAgQIECBAgAABAgQIECBQvoAOCRAgQIAAAQJVCAiYVKFoDAIECBAgUJ+AkQkQIECAAAECBAgQIECAAIHyBXRIgAABAgQIECBAIHkBAZPkl0iBBAikL6BCAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIECBAgQKDbAgIm3V7/7nSvUwIECBAgQIAAAQIECBAgQKB8AR0SIECAAAECBAgQIECAAAECtQkkEzCprUMDEyBAgAABAgQIECBAgAABAskIKIQAAQIECBAgQIAAAQIECBAoX0CHZQoImJS5rroiQIAAAQIECBAgQIDARAVcR4AAAQIECBAgQIAAAQIECJQvoEMCBAj0LSBg0jeZCwgQIECAAAECBAi0LWB+AgQIECBAgAABAgQIECBAoHwBHRIgQIAAgbQEBEzSWg/VECBAgAABAqUI6IMAAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAIEOCQiYdGixtUqAAAECzxbwigABAgQIECBAgAABAgQIEChfQIcECBAgQIAAAQIECFQjIGBSjaNRCBCoR8CoBAgQIECAAAECBAgQIECAQPkCOiRAgAABAgQIECBAgACBDAQETDJYpLRLVB0BAgQIECBAgAABAgQIECBQvoAOCRAgQIAAAQIECBAgQIAAgfIFxu5QwGRsH58SIECAAAECBAgQIECAAIE8BFRJgAABAgQIECBAgAABAgQIlC+gQwItCgiYtIhvagIECBAgQIAAAQIEuiWgWwIECBAgQIAAAQIECBAgQKB8AR0SIECgVAEBk1JXVl8ECBAgQIAAAQITEXANAQIECBAgQIAAAQIECBAgUL6ADgkQIECAAIEJCAiYTADNJQQIECBAgECbAuYmQIAAAQIECBAgQIAAAQIEyhfQIQECBAgQIECAQGoCAiaprYh6CBAgUIKAHggQIECAAAECBAgQIECAAIHyBXRIgAABAgQIECBAgECnBARMOrXcmiWwScAzAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQIECBAgQIAAgaoEBEyqkqx+HCMSIECAAAECBAgQIECAAAEC5QvokAABAgQIECBAgAABAgQIEChfoIgOBUyKWEZNECBAgAABAgQIECBAgEB9AkYmQIAAAQIECBAgQIAAAQIEyhfQIQEC4wkImIwn5HMCBAgQIECAAAECBNIXUCEBAgQIECBAgAABAgQIECBQvoAOCRAgQKBVAQGTVvlNToAAAQIECBDojoBOCRAgQIAAAQIECBAgQIAAgfIFdEiAAAECBAiUKyBgUu7a6owAAQIECPQr4HwCBAgQIECAAAECBAgQIECgfAEdEiBAgAABAgQIEJiQgIDJhNhcRIAAgbYEzEuAAAECBAgQIECAAAECBAiUL6BDAgQIECBAgAABAgQIpCcgYJLemqgodwH1EyBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIAAAQIECHRMoJMBk46tsXYJECBAgAABAgQIECBAgEAnBTRNgAABAgQIECBAgAABAgQIlC+gw+YEBEyaszYTAQIECBAgQIAAAQIECDxbwCsCBAgQIECAAAECBAgQIECgfAEdEiBQiICASSELqQ0CBAgQIECAAAEC9QgYlQABAgQIECBAgAABAgQIEChfQIcECBAgQGB8AQGT8Y2cQYAAAQIECBBIW0B1BAgQIECAAAECBAgQIECAQPkCOiRAgAABAgQItCwgYNLyApieAAECBLohoEsCBAgQIECAAAECBAgQIECgfAEdEiBAgAABAgQIEChZQMCk5NXVGwEC/Qg4lwABAgQIECBAgAABAgQIEChfQIcECBAgQIAAAQIECBAgMEEBAZMJwrmsDQFzEiBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIAAAQIECBBIUaDagEmKHaqJAAECBAgQIECAAAECBAgQqFbAaAQIECBAgAABAgQIECBAgED5AjoksIWAgMkWIF4SIECAAAECBAgQIECgBAE9ECBAgAABAgQIECBAgAABAuUL6JAAAQJNCgiYNKltLgIECBAgQIAAAQKbBDwjQIAAAQIECBAgQIAAAQIEyhfQIQECBAgQKEZAwKSYpdQIAQIECBAgUL2AEQkQIECAAAECBAgQIECAAIHyBXRIgAABAgQIECDQi4CASS9KziFAgACBdAVURoAAAQIECBAgQIAAAQIECJQvoEMCBAgQIECAAAECBFoXEDBpfQkUQKB8AR0SIECAAAECBAgQIECAAAEC5QvokAABAgQIECBAgAABAgTKFhAwKXt9e+3OeQQIECBAgAABAgQIECBAgED5AjokQIAAAQIECBAgQIAAAQIEyheorUMBk9poDUyAAAECBAgQIECAAAECBPoVcD4BAgQIECBAgAABAgQIECBQvoAOCeQpIGCS57qpmgABAgQIECBAgACBtgTMS4AAAQIECBAgQIAAAQIECJQvoEMCBAgQ2EpAwGQrEm8QIECAAAECBAjkLqB+AgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQLNCgiYNOttNgIECBAgQGCjgJ8ECBAgQIAAAQIECBAgQIBA+QI6JECAAAECBAgQKEhAwKSgxdQKAQIEqhUwGgECBAgQIECAAAECBAgQIFC+gA4JECBAgAABAgQIECDQm4CASW9OziKQpoCqCBAgQIAAAQIECBAgQIAAgfIFdEiAAAECBAgQIECAAAECBBIQEDCpeREMT4AAAQIECBAgQIAAAQIECJQvoEMCBAgQIECAAAECBAgQIECgfIGudyhg0vVvgP4JECBAgAABAgQIECDQDQFdEiBAgAABAgQIECBAgAABAuUL6JAAgRoFBExqxDU0AQIECBAgQIAAAQL9CDiXAAECBAgQIECAAAECBAgQKF9AhwQIECCQq4CASa4rp24CBAgQIECAQBsC5iRAgAABAgQIECBAgAABAgTKF9AhAQIECBAgQGAEAQGTEVC8RYAAAQIEchZQOwECBAgQIECAAAECBAgQIFC+gA4JECBAgAABAgQINC0gYNK0uPkIECAQAgMCBAgQIECAAAECBAgH+nIIAAAQAElEQVQQIECgfAEdEiBAgAABAgQIECBAoCgBAZOillMz1QkYiQABAgQIECBAgAABAgQIEChfQIcECBAgQIAAAQIECBAgQIBArwL5Bkx67dB5BAgQIECAAAECBAgQIECAQL4CKidAgAABAgQIECBAgAABAgTKF9BhFgICJlkskyIJECBAgAABAgQIECCQroDKCBAgQIAAAQIECBAgQIAAgfIFdEiAAAEBE98BAgQIECBAgAABAuUL6JAAAQIECBAgQIAAAQIECBAoX0CHBAgQIECgVgEBk1p5DU6AAAECBAgQ6FXAeQQIECBAgAABAgQIECBAgED5AjokQIAAAQIECOQrIGCS79qpnAABAgSaFjAfAQIECBAgQIAAAQIECBAgUL6ADgkQIECAAAECBAgQGFFAwGREFm8SIJCrgLoJECBAgAABAgQIECBAgACB8gV0SIAAAQIECBAgQIAAAQLNCwiYNG/e9Rn1T4AAAQIECBAgQIAAAQIECJQvoEMCBAgQIECAAAECBAgQIECgMIERAiaFdagdAgQIECBAgAABAgQIECBAYAQBbxEgQIAAAQIECBAgQIAAAQLlC+iQQHUCAibVWRqJAAECBAgQIECAAAEC1QoYjQABAgQIECBAgAABAgQIEChfQIcECBDIREDAJJOFUiYBAgQIECBAgECaAqoiQIAAAQIECBAgQIAAAQIEyhfQIQECBAgQIBCCgIlvAQECBAgQIFC6gP4IECBAgAABAgQIECBAgACB8gV0SIAAAQIECBAgULOAgEnNwIYnQIAAgV4EnEOAAAECBAgQIECAAAECBAiUL6BDAgQIECBAgAABAgRyFhAwyXn11E6gSQFzESBAgAABAgQIECBAgAABAuUL6JAAAQIECBAgQIAAAQIECIwiIGAyCkyOb6uZAAECBAgQIECAAAECBAgQKF9AhwQIECBAgAABAgQIECBAgED5Ail2KGCS4qqoiQABAgQIECBAgAABAgRyFlA7AQIECBAgQIAAAQIECBAgUL6ADgl0TkDApHNLrmECBAgQIECAAAECBEJgQIAAAQIECBAgQIAAAQIECJQvoEMCBAgQqFJAwKRKTWMRIECAAAECBAhUJ2AkAgQIECBAgAABAgQIECBAoHwBHRIgQIAAAQLZCAiYZLNUCiVAgAABAukJqIgAAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAAECBKKAgElUcBAgQKBcAZ0RIECAAAECBAgQIECAAAEC5QvokAABAgQIECBAgAABArULCJjUTmwCAuMJ+JwAAQIECBAgQIAAAQIECBAoX0CHBAgQIECAAAECBAgQIEAgbwEBk17WzzkECBAgQIAAAQIECBAgQIBA+QI6JECAAAECBAgQIECAAAECBMoX0OGEBQRMJkznQgIECBAgQIAAAQIECBBoWsB8BAgQIECAAAECBAgQIECAQPkCOiRAIE0BAZM010VVBAgQIECAAAECBHIVUDcBAgQIECBAgAABAgQIECBQvoAOCRAg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AQIECBAgQIBANQJ6IUCAAAECBAgQIECAAAECBMoXkCEBAgQ6F1Bg0rmVlgQIECBAgAABAgTSEhANAQIECBAgQIAAAQIECBAgUL6ADAkQIECAQCICCkwSmQhhECBAgAABAmUKyIoAAQIECBAgQIAAAQIECBAoX0CGBAgQIECAAIE2CCgwacMsy5EAAQIEhhPwGgECBAgQIECAAAECBAgQIFC+gAwJECBAgAABAgQIEBilgAKTUQI6nACBXggYgwABAgQIECBAgAABAgQIEChfQIYECBAgQIAAAQIECBAgkLKAApOUZyen2MRKgAABAgQIECBAgAABAgQIlC8gQwIECBAgQIAAAQIECBAgQKB8gSEyVGAyBIzdBAgQIECAAAECBAgQIEAgRwExEyBAgAABAgQIECBAgAABAuULyJBAEwIKTJpQNyYBAgQIECBAgAABAm0WkDsBAgQIECBAgAABAgQIECBQvoAMCRAgUJyAApPiplRCBAgQIECAAAECoxfQAwECBAgQIECAAAECBAgQIFC+gAwJECBAgACBbgQUmHSjpS0BAgQIECCQjoBICBAgQIAAAQIECBAgQIAAgfIFZEiAAAECBAgQIJCMgAKTZKZCIAQIEChPQEYECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIECgHQIKTNoxz7IkMJSA/QQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECBAgQIAAAQKjFlBgMmrCujvQPwECBAgQIECAAAECBAgQIFC+gAwJECBAgAABAgQIECBAgACB8gXyzlCBSd7zJ3oCBAgQIECAAAECBAgQ6JWAcQgQIECAAAECBAgQIECAAIHyBWRIgMCQAgpMhqTxAgECBAgQIECAAAECuQmIlwABAgQIECBAgAABAgQIEChfQIYECBAg0IyAApNm3I1KgAABAgQIEGirgLwJECBAgAABAgQIECBAgACB8gVkSIAAAQIECBQooMCkwEmVEgECBAgQGJ2AowkQIECAAAECBAgQIECAAIHyBWRIgAABAgQIECBAoDsBBSbdeWlNgACBNAREQYAAAQIECBAgQIAAAQIECJQvIEMCBAgQIECAAAECBAgkJKDAJKHJEEpZArIhQIAAAQIECBAgQIAAAQIEyheQIQECBAgQIECAAAECBAgQaItAmwtM2jLH8iRAgAABAgQIECBAgAABAm0WkDsBAgQIECBAgAABAgQIECBQvoAMeyCgwKQHyIYgQIAAAQIECBAgQIAAgeEEvEaAAAECBAgQIECAAAECBAiULyBDAgRyF1BgkvsMip8AAQIECBAgQIBALwSMQYAAAQIECBAgQIAAAQIECJQvIEMCBAgQIDCMgAKTYXC8RIAAAQIECBDISUCsBAgQIECAAAECBAgQIECAQPkCMiRAgAABAgQINCWgwKQpeeMSIECAQBsF5EyAAAECBAgQIECAAAECBAiULyBDAgQIECBAgAABAkUKKDApclolRYDAyAUcSYAAAQIECBAgQIAAAQIECJQvIEMCBAgQIECAAAECBAgQ6FZAgUm3Yto3LyACAgQIECBAgAABAgQIECBAoHwBGRIgQIAAAQIECBAgQIAAAQJJCdRSYJJUhoIhQIAAAQIECBAgQIAAAQIEahHQKQECBAgQIECAAAECBAgQIFC+gAwJDAgoMBmQcE+AAAECBAgQIECAAIHyBGREgAABAgQIECBAgAABAgQIlC8gQwIECPREQIFJT5gNQoAAAQIECBAgQGAoAfsJECBAgAABAgQIECBAgACB8gVkSIAAAQIE8hdQYJL/HMqAAAECBAgQqFtA/wQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECBAYVkCBybA8XiRAgACBXATESYAAAQIECBAgQIAAAQIECJQvIEMCBAgQIECAAAECBJoTUGDSnL2RCbRNQL4ECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIECAAIFCBRSYFDqxI0vLUQQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECBAgQIAAAQIEyheoPkMFJtWb6pEAAQIECBAgQIAAAQIECIxOwNEECBAgQIAAAQIECBAgQIBA+QIyJJCZgAKTzCZMuAQIECBAgAABAgQIpCEgCgIECBAgQIAAAQIECBAgQKB8ARkSIECAwBsCCkzesPCIAAECBAgQIECgLAHZECBAgAABAgQIECBAgAABAuULyJAAAQIECBDokYACkx5BG4YAAQIECBAYTMA+AgQIECBAgAABAgQIECBAoHwBGRIgQIAAAQIECJQgoMCkhFmUAwECBOoU0DcBAgQIECBAgAABAgQIECBQvoAMCRAgQIAAAQIECBAgsAYBBSZrAPIygRwExEiAAAECBAgQIECAAAECBAiULyBDAgQIECBAgAABAgQIECDQpIACk97oG4UAAQIECBAgQIAAAQIECBAoX0CGBAgQIECAAAECBAgQIECAQPkCrc1QgUlrp17iBAgQIECAAAECBAgQaKOAnAkQIECAAAECBAgQIECAAIHyBWRIgEAdAgpM6lDVJwECBAgQIECAAAECIxdwJAECBAgQIECAAAECBAgQIFC+gAwJECBAIDsBBSbZTZmACRAgQIAAAQLNC4iAAAECBAgQIECAAAECBAgQKF9AhgQIECBAgACBlQUUmKys4TEBAgQIEChHQCYECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQINAzAQUmPaM2EAECBFYV8JwAAQIECBAgQIAAAQIECBAoX0CGBAgQIECAAAECBAgQKENAgUkZ8yiLugT0S4AAAQIECBAgQIAAAQIECJQvIEMCBAgQIECAAAECBAgQIEBgjQLZF5isMUMNCBAgQIAAAQIECBAgQIAAgewFJECAAAECBAgQIECAAAECBAiULyDDtAUUmKQ9P6IjQIAAAQIECBAgQIBALgLiJECAAAECBAgQIECAAAECBMoXkCEBAi0WUGDS4smXOgECBAgQIECAQNsE5EuAAAECBAgQIECAAAECBAiULyBDAgQIECBQj4ACk3pc9UqAAAECBAgQGJmAowgQIECAAAECBAgQIECAAIHyBWRIgAABAgQIEMhQQIFJhpMmZAIECBBoVsDoBAgQIECAAAECBAgQIECAQPkCMiRAgAABAgQIECBA4M0CCkze7OEZAQJlCMiCAAECBAgQIECAAAECBAgQKF9AhgQIECBAgAABAgQIECDQQwEFJj3ENtTKAh4TIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAgAABAgQIEChFYOgCk1IylAcBAgQIECBAgAABAgQIECAwtIBXCBAgQIAAAQIECBAgQIAAgfIFZEigAgEFJhUg6oIAAQIECBAgQIAAAQJ1CuibAAECBAgQIECAAAECBAgQKF9AhgQIEEhdQIFJ6jMkPgIECBAgQIAAgRwExEiAAAECBAgQIECAAAECBAiULyBDAgQIECDQagEFJq2efskTIECAAIE2CciVAAECBAgQIECAAAECBAgQKF9AhgQIECBAgAABAnUJKDCpS1a/BAgQINC9gCMIECBAgAABAgQIECBAgACB8gVkSIAAAQIECBAgQIBAlgIKTLKcNkETaE7AyAQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECBAgQIAAAQKrCigwWVUk/+cyIECAAAECBAgQIECAAAECBMoXkCEBAgQIECBAgAABAgQIECBQvkBSGSowSWo6BEOAAAECBAgQIECAAAEC5QjIhAABAgQIECBAgAABAgQIEChfQIYE2iOgwKQ9cy1TAgQIECBAgAABAgRWFfCcAAECBAgQIECAAAECBAgQKF9AhgQIECBQiYACk0oYdUKAAAECBAgQIFCXgH4JECBAgAABAgQIECBAgACB8gVkSIAAAQIECKQvoMAk/TkSIQECBAgQSF1AfAQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECBBouYACk5a/AaRPgEBbBORJgAABAgQIECBAgAABAgQIlC8gQwIECBAgQIAAAQIECNQnoMCkPls9E+hOQGsCBAgQIECAAAECBAgQIECgfAEZEiBAgAABAgQIECBAgACBTAUUmHQxcZoSIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAgAABAgQIEChfQIbdCygw6d7MEQQIECBAgAABAgQIECDQrIDRCRAgQIAAAQIECBAgQIAAgfIFZEiAQGICCkwSmxDhECBAgAABAgQIEChDQBYECBAgQIAAAQIECBAgQIBA+QIyJECAAIE2CSgwadNsy5UAAQIECBAgsLKAxwQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECFQkoMCkIkjdECBAgACBOgT0SYAAAQIECBAgQIAAAQIECJQvIEMCBAgQIECAAAECOQgoMMlhlsRIgEDKAmIjQIAAAQIECBAgQIAAAQIEyheQIQECBAgQIECAAAECBFovoMCk9W+BNgDIkQABAgQIECBAgAABAgQIEChfQIYECBAgQIAAAQIECBAgQIBAnQJpFJjUmaG+CRAgQIAAAQIECBAgQIAAgTQEREGAAAECBAgQIECAAAECBAiULyDDYgUUmBQ7tRIjQIAAAQIECBAgQIBA9wKOIECAAAECBAgQIECAAAECBMoXkCEBAgRGIqDAZCRqjiFAgAABAgQIECDQnICRCRAgQIAAAQIECBAgQIAAgfIFZEiAAAECBJITUGCS3JQIiAABAgQIEMhfQAYECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAi0S0CBSbvmW7YECBAgMCDgngABAgQIECBAgAABAgQIEChfQIYECBAgQIAAAQIECFQmoMCkMkodqQlKMwAAEABJREFUESBQtYD+CBAgQIAAAQIECBAgQIAAgfIFZEiAAAECBAgQIECAAAECeQgoMMljnlKNUlwECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIECAAAECBMoXWGOGCkzWSKQBAQIECBAgQIAAAQIECBBIXUB8BAgQIECAAAECBAgQIECAQPkCMiTQrIACk2b9jU6AAAECBAgQIECAQFsE5EmAAAECBAgQIECAAAECBAiULyBDAgQIFCygwKTgyZUaAQIECBAgQIBAdwJaEyBAgAABAgQIECBAgAABAuULyJAAAQIECBAYmYACk5G5OYoAAQIECBBoRsCoBAgQIECAAAECBAgQIECAQPkCMiRAgAABAgQIEEhQQIFJgpMiJAIECOQtIHoCBAgQIECAAAECBAgQIECgfAEZEiBAgAABAgQIECDQNgEFJm2bcfkSiAI2AgQIECBAgAABAgQIECBAoHwBGRIgQIAAAQIECBAgQIAAgQoFFJhUiFllV/oiQIAAAQIECBAgQIAAAQIEyheQIQECBAgQIECAAAECBAgQIFC+QCkZKjApZSblQYAAAQIECBAgQIAAAQJ1COiTAAECBAgQIECAAAECBAgQKF9AhgQIdCCgwKQDJE0IECBAgAABAgQIEEhZQGwECBAgQIAAAQIECBAgQIBA+QIyJECAAIGmBRSYND0DxidAgAABAgQItEFAjgQIECBAgAABAgQIECBAgED5AjIkQIAAAQIEihZQYFL09EqOAAECBAh0LqAlAQIECBAgQIAAAQIECBAgUL6ADAkQIECAAAECBAiMVECByUjlHEeAAIHeCxiRAAECBAgQIECAAAECBAgQKF9AhgQIECBAgAABAgQIEEhSQIFJktMiqHwFRE6AAAECBAgQIECAAAECBAiULyBDAgQIECBAgAABAgQIECDQPoH2FZi0b45lTIAAAQIECBAgQIAAAQIE2icgYwIECBAgQIAAAQIECBAgQKB8ARn2VECBSU+5DUaAAAECBAgQIECAAAECAwLuCRAgQIAAAQIECBAgQIAAgfIFZEiAQDkCCkzKmUuZECBAgAABAgQIEKhaQH8ECBAgQIAAAQIECBAgQIBA+QIyJECAAAECHQkoMOmISSMCBAgQIECAQKoC4iJAgAABAgQIECBAgAABAgTKF5AhAQIECBAgQKB5AQUmzc+BCAgQIECgdAH5ESBAgAABAgQIECBAgAABAuULyJAAAQIECBAgQIBA4QIKTAqfYOkRINCZgFYECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIECAAIGRCygwGbmdI3srYDQCBAgQIECAAAECBAgQIECgfAEZEiBAgAABAgQIECBAgAABAokKVFhgkmiGwiJAgAABAgQIECBAgAABAgQqFNAVAQIECBAgQIAAAQIECBAgUL6ADAmsLqDAZHUTewgQIECAAAECBAgQIJC3gOgJECBAgAABAgQIECBAgACB8gVkSIAAgR4LKDDpMbjhCBAgQIAAAQIECEQBGwECBAgQIECAAAECBAgQIFC+gAwJECBAgEBJAgpMSppNuRAgQIAAAQJVCuiLAAECBAgQIECAAAECBAgQKF9AhgQIECBAgAABAh0KKDDpEEozAgQIEEhRQEwECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIEAgBQEFJinMghgIlCwgNwIECBAgQIAAAQIECBAgQKB8ARkSIECAAAECBAgQIECAQPECCkyKn+I1J6gFAQIECBAgQIAAAQIECBAgUL6ADAkQIECAAAECBAgQIECAAIHyBerMUIFJnbr6JkCAAAECBAgQIECAAAECnQtoSYAAAQIECBAgQIAAAQIECJQvIEMC2QooMMl26gROgAABAgQIECBAgEDvBYxIgAABAgQIECBAgAABAgQIlC8gQwIECBAYTECByWAq9hEgQIAAAQIECOQrIHICBAgQIECAAAECBAgQIECgfAEZEiBAgAABAj0XUGDSc3IDEiBAgAABAgQIECBAgAABAgQIECBAgACB8gVkSIAAAQIECBAgUJaAApOy5lM2BAgQqEpAPwQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECBAgQIBAxwIKTDqm0pBAagLiIUCAAAECBAgQIECAAAECBMoXkCEBAgQIECBAgAABAgQIEEhDQIFJnfOgbwIECBAgQIAAAQIECBAgQKB8ARkSIECAAAECBAgQIECAAAEC5QvIMCgw8SYgQIAAAQIECBAgQIAAgeIFJEiAAAECBAgQIECAAAECBAiULyBDAgTqFVBgUq+v3gkQIECAAAECBAgQ6ExAKwIECBAgQIAAAQIECBAgQKB8ARkSIECAQMYCCkwynjyhEyBAgAABAgR6K2A0AgQIECBAgAABAgQIECBAoHwBGRIgQIAAAQIEBhdQYDK4i70ECBAgQCBPAVETIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAgEADAgpMGkA3JAEC7RaQPQECBAgQIECAAAECBAgQIFC+gAwJECBAgAABAgQIECBQmoACk9JmVD5VCOiDAAECBAgQIECAAAECBAgQKF9AhgQIECBAgAABAgQIECBAgEAXApkWmHSRoaYECBAgQIAAAQIECBAgQIBApgLCJkCAAAECBAgQIECAAAECBMoXkGEuAgpMcpkpcRIgQIAAAQIECBAgQCBFATERIECAAAECBAgQIECAAAEC5QvIkAABAssFFJgsR/A/AQIECBAgQIAAgZIF5EaAAAECBAgQIECAAAECBAiULyBDAgQIECBQt4ACk7qF9U+AAAECBAgQWLOAFgQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECGQtoMAk6+kTPAECBAj0TsBIBAgQIECAAAECBAgQIECAQPkCMiRAgAABAgQIECBAYCgBBSZDydhPgEB+AiImQIAAAQIECBAgQIAAAQIEyheQIQECBAgQIECAAAECBAg0IqDApBH29g4qcwIECBAgQIAAAQIECBAgQKB8ARkSIECAAAECBAgQIECAAAEC5QmsWmBSXoYyIkCAAAECBAgQIECAAAECBFYV8JwAAQIECBAgQIAAAQIECBAoX0CGBCoVUGBSKafOCBAgQIAAAQIECBAgUJWAfggQIECAAAECBAgQIECAAIHyBWRIgACBfAQUmOQzVyIlQIAAAQIECBBITUA8BAgQIECAAAECBAgQIECAQPkCMiRAgAABAgRWCCgwWcHghgABAgQIEChVQF4ECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQqF9AgUn9xkYgQIAAgeEFvEqAAAECBAgQIECAAAECBAiULyBDAgQIECBAgAABAgQyF1BgkvkECp9AbwSMQoAAAQIECBAgQIAAAQIECJQvIEMCBAgQIECAAAECBAgQIDC0gAKToW3yekW0BAgQIECAAAECBAgQIECAQPkCMiRAgAABAgQIECBAgAABAgTKF0g0QwUmiU6MsAgQIECAAAECBAgQIEAgTwFREyBAgAABAgQIECBAgAABAuULyJBAGwUUmLRx1uVMgAABAgQIECBAoN0CsidAgAABAgQIECBAgAABAgTKF5AhAQIECFQsoMCkYlDdESBAgAABAgQIVCGgDwIECBAgQIAAAQIECBAgQKB8ARkSIECAAAECOQkoMMlptsRKgAABAgRSEhALAQIECBAgQIAAAQIECBAgUL6ADAkQIECAAAECBAj8SkCBya8g3BEgQKBEATkRIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAgAABAr0QUGDSC2VjEBhawCsECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIECAAAEC2QsoMFnjFGpAgAABAgQIECBAgAABAgQIlC8gQwIECBAgQIAAAQIECBAgQKB8ARmORkCByWj0HEuAAAECBAgQIECAAAECvRMwEgECBAgQIECAAAECBAgQIFC+gAwJEEhWQIFJslMjMAIECBAgQIAAAQL5CYiYAAECBAgQIECAAAECBAgQKF9AhgQIECDQTgEFJu2cd1kTIECAAAEC7RWQOQECBAgQIECAAAECBAgQIFC+gAwJECBAgAABApULKDCpnFSHBAgQIEBgtAKOJ0CAAAECBAgQIECAAAECBMoXkCEBAgQIECBAgACBvAQUmOQ1X6IlQCAVAXEQIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAgAABAgReF1Bg8jqFB6UJyIcAAQIECBAgQIAAAQIECBAoX0CGBAgQIECAAAECBAgQIECAQG8Emiww6U2GRiFAgAABAgQIECBAgAABAgSaFDA2AQIECBAgQIAAAQIECBAgUL6ADFsgoMCkBZMsRQIECBAgQIAAAQIECAwv4FUCBAgQIECAAAECBAgQIECgfAEZEiBAYHQCCkxG5+doAgQIECBAgAABAr0RMAoBAgQIECBAgAABAgQIECBQvoAMCRAgQIBAwgIKTBKeHKERIECAAAECeQmIlgABAgQIECBAgAABAgQIEChfQIYECBAgQIAAgbYKKDBp68zLmwABAu0UkDUBAgQIECBAgAABAgQIECBQvoAMCRAgQIAAAQIECBCoQUCBSQ2ouiRAYDQCjiVAgAABAgQIECBAgAABAgTKF5AhAQIECBAgQIAAAQIECOQmoMAktxlLIV4xECBAgAABAgQIECBAgAABAuULyJAAAQIECBAgQIAAAQIECBAoX6CLDBWYdIGlKQECBAgQIECAAAECBAgQSElALAQIECBAgAABAgQIECBAgED5AjIkkIqAApNUZkIcBAgQIECAAAECBAiUKCAnAgQIECBAgAABAgQIECBAoHwBGRIgQKAVAgpMWjHNkiRAgAABAgQIEBhawCsECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBEYroMBktIKOJ0CAAAECBOoXMAIBAgQIECBAgAABAgQIECBQvoAMCRAgQIAAAQIEkhZQYJL09AiOAAEC+QiIlAABAgQIECBAgAABAgQIEChfQIYECBAgQIAAAQIECLRXQIFJe+de5u0TkDEBAgQIECBAgAABAgQIECBQvoAMCRAgQIAAAQIECBAgQIBALQIKTGphHWmnjiNAgAABAgQIECBAgAABAgTKF5AhAQIECBAgQIAAAQIECBAgUL5AeRkqMClvTmVEgAABAgQIECBAgAABAqMVcDwBAgQIECBAgAABAgQIECBQvoAMCRDoSkCBSVdcGhMgQIAAAQIECBAgkIqAOAgQIECAAAECBAgQIECAAIHyBWRIgAABAukIKDBJZy5EQoAAAQIECBAoTUA+BAgQIECAAAECBAgQIECAQPkCMiRAgAABAgRaIqDApCUTLU0CBAgQIDC4gL0ECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIDB6AQUmozfUAwECBOoV0DsBAgQIECBAgHM7pjwAABAASURBVAABAgQIECBQvoAMCRAgQIAAAQIECBAgkLiAApPEJ0h4eQiIkgABAgQIECBAgAABAgQIEChfQIYECBAgQIAAAQIECBAgQKDNAm0pMGnzHMudAAECBAgQIECAAAECBAi0RUCeBAgQIECAAAECBAgQIECAQPkCMmxIQIFJQ/CGJUCAAAECBAgQIECAQDsFZE2AAAECBAgQIECAAAECBAiULyBDAgRKFFBgUuKsyokAAQIECBAgQIDAaAQcS4AAAQIECBAgQIAAAQIECJQvIEMCBAgQINClgAKTLsE0J0CAAAECBAikICAGAgQIECBAgAABAgQIECBAoHwBGRIgQIAAAQIEUhJQYJLSbIiFAAECBEoSkAsBAgQIECBAgAABAgQIECBQvoAMCRAgQIAAAQIECLRGQIFJa6ZaogQIrC5gDwECBAgQIECAAAECBAgQIFC+gAwJECBAgAABAgQIECBAoAoBBSZVKOqjPgE9EyBAgAABAgQIECBAgAABAuULyJAAAQIECBAgQIAAAQIECBBIXmDUBSbJZyhAAgQIECBAgAABAgQIECBAYNQCOiBAgAABAgQIECBAgAABAgTKF5AhgeEEFJgMp+M1AgQIECBAgAABAgQI5CMgUgIECBAgQIAAAQIECBAgQKB8ARkSIECgMQEFJo3RG5gAAQIECBAgQKB9AjImQIAAAQIECBAgQIAAAQIEyheQIQECBAgQKFNAgUmZ8yorAgQIECBAYKQCjiNAgAABAgQIECBAgAABAgTKF5AhAQIECBAgQIBA1wIKTLomcwABAgQINC1gfAIECBAgQIAAAQIECBAgQKB8ARkSIECAAAECBAgQIJCWgAKTtOZDNARKEZAHAQIECBAgQIAAAQIECBAgUL6ADAkQIECAAAECBAgQIECgRQIKTFo02W9O1TMCBAgQIECAAAECBAgQIECgfAEZEiBAgAABAgQIECBAgAABAuUL9CZDBSa9cTYKAQIECBAgQIAAAQIECBAYXMBeAgQIECBAgAABAgQIECBAoHwBGRIoQECBSQGTKAUCBAgQIECAAAECBOoV0DsBAgQIECBAgAABAgQIECBQvoAMCRAgQGB4AQUmw/t4lQABAgQIECBAIA8BURIgQIAAAQIECBAgQIAAAQLlC8iQAAECBAgQaFBAgUmD+IYmQIAAAQLtEpAtAQIECBAgQIAAAQIECBAgUL6ADAkQIECAAAECBEoVUGBS6szKiwABAiMRcAwBAgQIECBAgAABAgQIECBQvoAMCRAgQIAAAQIECBAgMAIBBSYjQHMIgSYFjE2AAAECBAgQIECAAAECBAiULyBDAgQIECBAgAABAgQIECCQmoACk+pnRI8ECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIECAAAECBMoXkOFKAgpMVsLwkAABAgQIECBAgAABAgRKEpALAQIECBAgQIAAAQIECBAgUL6ADAkQ6JWAApNeSRuHAAECBAgQIECAAIHVBewhQIAAAQIECBAgQIAAAQIEyheQIQECBAgUIaDApIhplAQBAgQIECBAoD4BPRMgQIAAAQIECBAgQIAAAQLlC8iQAAECBAgQILAmAQUmaxLyOgECBAgQSF9AhAQIECBAgAABAgQIECBAgED5AjIkQIAAAQIECBAg0KiAApNG+Q1OgEB7BGRKgAABAgQIECBAgAABAgQIlC8gQwIECBAgQIAAAQIECJQroMCk3LmVWbcC2hMgQIAAAQIECBAgQIAAAQLlC8iQAAECBAgQIECAAAECBAgQGJFAVgUmI8rQQQQIECBAgAABAgQIECBAgEBWAoIlQIAAAQIECBAgQIAAAQIEyheQYX4CCkzymzMREyBAgAABAgQIECBAoGkB4xMgQIAAAQIECBAgQIAAAQLlC8iQAAECbxJQYPImDk8IECBAgAABAgQIlCIgDwIECBAgQIAAAQIECBAgQKB8ARkSIECAAIHeCSgw6Z21kQgQIECAAAECbxbwjAABAgQIECBAgAABAgQIEChfQIYECBAgQIAAgUIEFJgUMpHSIECAAIF6BPRKgAABAgQIECBAgAABAgQIlC8gQwIECBAgQIAAAQIE1iygwGTNRloQIJC2gOgIECBAgAABAgQIECBAgACB8gVkSIAAAQIECBAgQIAAAQINCygwaXgC2jG8LAkQIECAAAECBAgQIECAAIHyBWRIgAABAgQIECBAgAABAgQIlCzQX2BScoZyI0CAAAECBAgQIECAAAECBPoF3BIgQIAAAQIECBAgQIAAAQLlC8iQQE0CCkxqgtUtAQIECBAgQIAAAQIERiLgGAIECBAgQIAAAQIECBAgQKB8ARkSIEAgRwEFJjnOmpgJECBAgAABAgSaFDA2AQIECBAgQIAAAQIECBAgUL6ADAkQIECAAIFVBBSYrALiKQECBAgQIFCCgBwIECBAgAABAgQIECBAgACB8gVkSIAAAQIECBAg0EsBBSa91DYWAQIECLwh4BEBAgQIECBAgAABAgQIECBQvoAMCRAgQIAAAQIECBAoRkCBSTFTKREC1QvokQABAgQIECBAgAABAgQIEChfQIYECBAgQIAAAQIECBAgQKATAQUmnSil20ZkBAgQIECAAAECBAgQIECAQPkCMiRAgAABAgQIECBAgAABAgTKF0g+QwUmyU+RAAkQIECAAAECBAgQIEAgfQEREiBAgAABAgQIECBAgAABAuULyJBAuwUUmLR7/mVPgAABAgQIECBAoD0CMiVAgAABAgQIECBAgAABAgTKF5AhAQIECNQmoMCkNlodEyBAgAABAgQIdCugPQECBAgQIECAAAECBAgQIFC+gAwJECBAgACBPAUUmOQ5b6ImQIAAAQJNCRiXAAECBAgQIECAAAECBAgQKF9AhgQIECBAgAABAgRWE1BgshqJHQQIEMhdQPwECBAgQIAAAQIECBAgQIBA+QIyJECAAAECBAgQIECAQG8FFJj01ttoBPoF3BIgQIAAAQIECBAgQIAAAQLlC8iQAAECBAgQIECAAAECBAgUJKDAZIjJtJsAAQIECBAgQIAAAQIECBAoX0CGBAgQIECAAAECBAgQIECAQPkCMqxGQIFJNY56IUCAAAECBAgQIECAAIF6BPRKgAABAgQIECBAgAABAgQIlC8gQwIEMhBQYJLBJAmRAAECBAgQIECAQNoCoiNAgAABAgQIECBAgAABAgTKF5AhAQIECLRdQIFJ298B8idAgAABAgTaISBLAgQIECBAgAABAgQIECBAoHwBGRIgQIAAAQIEahRQYFIjrq4JECBAgEA3AtoSIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAgECuAgpMcp05cRMg0ISAMQkQIECAAAECBAgQIECAAIHyBWRIgAABAgQIECBAgAABAoMIKDAZBMWunAXEToAAAQIECBAgQIAAAQIECJQvIEMCBAgQIECAAAECBAgQIECg1wK9LzDpdYbGI0CAAAECBAgQIECAAAECBHovYEQCBAgQIECAAAECBAgQIECgfAEZtkpAgUmrpluyBAgQIECAAAECBAgQeEPAIwIECBAgQIAAAQIECBAgQKB8ARkSIECgKgEFJlVJ6ocAAQIECBAgQIBA9QJ6JECAAAECBAgQIECAAAECBMoXkCEBAgQIEMhCQIFJFtMkSAIECBAgQCBdAZERIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAQIGJ9wABAgQIlC8gQwIECBAgQIAAAQIECBAgQKB8ARkSIECAAAECBAgQIFCrgAKTWnl1ToBApwLaESBAgAABAgQIECBAgAABAuULyJAAAQIECBAgQIAAAQIE8hVQYJLv3PU6cuMRIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAgAABAgQIEChfYEQZKjAZEZuDCBAgQIAAAQIECBAgQIBAUwLGJUCAAAECBAgQIECAAAECBMoXkCGB9AQUmKQ3JyIiQIAAAQIECBAgQCB3AfETIECAAAECBAgQIECAAAEC5QvIkAABAi0TUGDSsgmXLgECBAgQIECAQL+AWwIECBAgQIAAAQIECBAgQKB8ARkSIECAAAEC1QkoMKnOUk8ECBAgQIBAtQJ6I0CAAAECBAgQIECAAAECBMoXkCEBAgQIECBAgEAmAgpMMpkoYRIgQCBNAVERIECAAAECBAgQIECAAAEC5QvIkAABAgQIECBAgAABAiEoMPEuIFC6gPwIECBAgAABAgQIECBAgACB8gVkSIAAAQIECBAgQIAAAQIEahZQYFIzcCfda0OAAAECBAgQIECAAAECBAiULyBDAgQIECBAgAABAgQIECBAoHyBkjNUYFLy7MqNAAECBAgQIECAAAECBLoR0JYAAQIECBAgQIAAAQIECBAoX0CGBAiMUECByQjhHEaAAAECBAgQIECAQBMCxiRAgAABAgQIECBAgAABAgTKF5AhAQIECKQooMAkxVkREwECBAgQIEAgZwGxEyBAgAABAgQIECBAgAABAuULyJAAAQIECBBonYACk9ZNuYQJECBAgEAIDAgQIECAAAECBAgQIECAAIHyBWRIgAABAgQIECBAoEoBBSZVauqLAAEC1QnoiQABAgQIECBAgAABAgQIEChfQIYECBAgQIAAAQIECBDIRkCBSTZTJdD0BEREgAABAgQIECBAgAABAgQIlC8gQwIECBAgQIAAAQIECBAgQCAKlF1gEjO0ESBAgAABAgQIECBAgAABAmULyI4AAQIECBAgQIAAAQIECBD4/9m1l6SGYSAIoPe/NYtUKjGFTSWyPtN6GyAxlqbfbJsAge4CCibdiV1AgAABAgQIECBAgACB/wQ8J0CAAAECBAgQIECAAAECBPIFJCRAgEBtAQWT2vszPQECBAgQIECAwCgB9xAgQIAAAQIECBAgQIAAAQL5AhISIECAAAECpwIKJqc0HhAgQIAAAQLVBMxLgAABAgQIECBAgAABAgQI5AtISIAAAQIECBAgMEdAwWSOu1sJECCwq4DcBAgQIECAAAECBAgQIECAQL6AhAQIECBAgAABAgQIBAoomAQuVSQCbQLeJkCAAAECBAgQIECAAAECBPIFJCRAgAABAgQIECBAgAABAp8JKJh85rXGf5uCAAECBAgQIECAAAECBAgQyBeQkAABAgQIECBAgAABAgQIEMgXKJRQwaTQsoxKgAABAgQIECBAgAABAmsJmIYAAQIECBAgQIAAAQIECBDIF5CQAIGHgILJw8FPAgQIECBAgAABAgQyBaQiQIAAAQIECBAgQIAAAQIE8gUkJECAAIEBAgomA5BdQYAAAQIECBAgcCXgGQECBAgQIECAAAECBAgQIJAvICEBAgQIECBQXUDBpPoGzU+AAAECBEYIuIMAAQIECBAgQIAAAQIECBDIF5CQAAECBAgQIECAwIWAgskFjkcECBCoJGBWAgQIECBctTYPAAAFU0lEQVRAgAABAgQIECBAIF9AQgIECBAgQIAAAQIECMwSUDCZJe/eHQVkJkCAAAECBAgQIECAAAECBPIFJCRAgAABAgQIECBAgAABApECCiaHtfpAgAABAgQIECBAgAABAgQI5AtISIAAAQIECBAgQIAAAQIECOQLSHi3gILJ3aLOI0CAAAECBAgQIECAAIF2AScQIECAAAECBAgQIECAAAEC+QISEiBQSkDBpNS6DEuAAAECBAgQIEBgHQGTECBAgAABAgQIECBAgAABAvkCEhIgQIAAgaeAgslTwm8CBAgQIECAQJ6ARAQIECBAgAABAgQIECBAgEC+gIQECBAgQIAAgSECCiZDmF1CgAABAgTOBHxPgAABAgQIECBAgAABAgQI5AtISIAAAQIECBAgQKC+gIJJ/R1KQIBAbwHnEyBAgAABAgQIECBAgAABAvkCEhIgQIAAAQIECBAgQIDApYCCySWPh1UEzEmAAAECBAgQIECAAAECBAjkC0hIgAABAgQIECBAgAABAgQIzBMYVTCZl9DNBAgQIECAAAECBAgQIECAwCgB9xAgQIAAAQIECBAgQIAAAQL5AhJuKqBgsunixSZAgAABAgQIECBAYFcBuQkQIECAAAECBAgQIECAAIF8AQkJECBwv4CCyf2mTiRAgAABAgQIECDQJuBtAgQIECBAgAABAgQIECBAIF9AQgIECBAgUExAwaTYwoxLgAABAgQIrCFgCgIECBAgQIAAAQIECBAgQCBfQEICBAgQIECAAIGXgILJy8JfBAgQIJAlIA0BAgQIECBAgAABAgQIECCQLyAhAQIECBAgQIAAAQKDBBRMBkG7hgCBvwR8R4AAAQIECBAgQIAAAQIECOQLSEiAAAECBAgQIECAAAECCQIKJglb7JnB2QQIECBAgAABAgQIECBAgEC+gIQECBAgQIAAAQIECBAgQIBAvkBjQgWTRkCvEyBAgAABAgQIECBAgACBEQLuIECAAAECBAgQIECAAAECBPIFJCSwsoCCycrbMRsBAgQIECBAgAABApUEzEqAAAECBAgQIECAAAECBAjkC0hIgACBbQUUTLZdveAECBAgQIAAgR0FZCZAgAABAgQIECBAgAABAgTyBSQkQIAAAQIEeggomPRQdSYBAgQIECDwvYA3CRAgQIAAAQIECBAgQIAAgXwBCQkQIECAAAECBMoJKJiUW5mBCRAgMF/ABAQIECBAgAABAgQIECBAgEC+gIQECBAgQIAAAQIECBB4F1AwedfwN4EcAUkIECBAgAABAgQIECBAgACBfAEJCRAgQIAAAQIECBAgQIDAMAEFk2HUvy/ymQABAgQIECBAgAABAgQIEMgXkJAAAQIECBAgQIAAAQIECBDIF9gjoYLJHnuWkgABAgQIECBAgAABAgTOBHxPgAABAgQIECBAgAABAgQI5AtISIBAs4CCSTOhAwgQIECAAAECBAgQ6C3gfAIECBAgQIAAAQIECBAgQCBfQEICBAgQWFtAwWTt/ZiOAAECBAgQIFBFwJwECBAgQIAAAQIECBAgQIBAvoCEBAgQIECAwMYCCiYbL190AgQIENhNQF4CBAgQIECAAAECBAgQIEAgX0BCAgQIECBAgAABAn0EFEz6uDqVAAEC3wl4iwABAgQIECBAgAABAgQIEMgXkJAAAQIECBAgQIAAAQIFBRRMCi7NyHMF3E6AAAECBAgQIECAAAECBAjkC0hIgAABAgQIECBAgAABAgQIHAUSCybHhD4RIECAAAECBAgQIECAAAECiQIyESBAgAABAgQIECBAgAABAvkCEi4k8AMAAP//qEOwegAAAAZJREFUAwA3NUaUqH8z0wAAAABJRU5ErkJggg==";

    // =========================================================================
    // === CAPA 0: FONDOS (Se dibujan primero para que el marco no quede tapado) ===
    // =========================================================================
    // Barra superior azul exacta
    doc.setFillColor(26, 58, 138);
    doc.rect(marginX, startY, pageWidth - 2 * marginX, 6, 'F');

    // Caja destacada de Monto Total (Fondo y borde)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.roundedRect(marginX + 8, startY + 113, cardWidth - 16, 18, 3, 3, 'FD');

    // Badge "PAGADO" (Fondo y borde verde esmeralda)
    doc.setFillColor(209, 250, 229); // #d1fae5
    doc.setDrawColor(16, 185, 129);  // #10b981
    doc.setLineWidth(0.4);
    doc.roundedRect(pageWidth - marginX - 31, startY + 94.5, 25, 6.5, 2, 2, 'FD');

    // =========================================================================
    // === REPARACIÓN DEL MARCO: DIBUJADO AL FINAL DE LOS FONDOS ===
    // =========================================================================
    doc.setDrawColor(26, 58, 138); // Azul de marca AL-DIA
    doc.setLineWidth(0.7);
    doc.rect(marginX, startY, pageWidth - 2 * marginX, cardHeight);

    // =========================================================================
    // === CABECERA A 2 COLUMNAS (Logo Izquierda + Títulos y Folio Derecha) ===
    // =========================================================================
    // Logo alineado a la izquierda con padding de seguridad
    if (logoBase64 && logoBase64.trim() !== "") {
        doc.addImage(logoBase64, 'PNG', marginX + 3, startY + 7, 52, 16.5);
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(26, 58, 138);
        doc.text("AL-DIA", marginX + 4, startY + 16);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Control de Arrendamientos", marginX + 4, startY + 22);
    }

    // Títulos alineados a la derecha con padding derecho (-5 mm) y tamaño ajustado
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 58, 138);
    doc.text("COMPROBANTE DE PAGO", pageWidth - marginX - 5, startY + 12, { align: "right" });

    const numRecibo = pago.id_recibo ? (String(pago.id_recibo).replace(/^REC-/, '')) : pago.id.toString().slice(-6);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Recibo N°: REC-${numRecibo}`, pageWidth - marginX - 5, startY + 18, { align: "right" });

    // Línea separadora de cabecera
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX + 6, startY + 28, marginX + cardWidth - 6, startY + 28);

    // =========================================================================
    // === SECCIÓN 1: DATOS DEL INQUILINO ===
    // =========================================================================
    doc.setFillColor(26, 58, 138);
    doc.rect(marginX + 8, startY + 32.5, 2.5, 4.5, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(26, 58, 138);
    doc.text("DATOS DEL INQUILINO", marginX + 13, startY + 36);

    // Inquilino
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Inquilino:", marginX + 8, startY + 43);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(nombreInquilino, marginX + 48, startY + 43);

    // Cuarto
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Cuarto:", marginX + 8, startY + 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(refInquilino, marginX + 48, startY + 50);

    // Línea separadora
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX + 6, startY + 56, marginX + cardWidth - 6, startY + 56);

    // =========================================================================
    // === SECCIÓN 2: DETALLES DEL COBRO ===
    // =========================================================================
    doc.setFillColor(26, 58, 138);
    doc.rect(marginX + 8, startY + 60.5, 2.5, 4.5, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(26, 58, 138);
    doc.text("DETALLES DEL COBRO", marginX + 13, startY + 64);

    // Concepto
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Concepto:", marginX + 8, startY + 71);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(concepto, marginX + 48, startY + 71);

    // Fecha de vencimiento (Casing estricto)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Fecha de vencimiento:", marginX + 8, startY + 78);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(fechaVencimiento), marginX + 48, startY + 78);

    // Línea separadora
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX + 6, startY + 84, marginX + cardWidth - 6, startY + 84);

    // =========================================================================
    // === SECCIÓN 3: LIQUIDACIÓN Y PAGO ===
    // =========================================================================
    doc.setFillColor(26, 58, 138);
    doc.rect(marginX + 8, startY + 88.5, 2.5, 4.5, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(26, 58, 138);
    doc.text("LIQUIDACIÓN Y PAGO", marginX + 13, startY + 92);

    // Método de pago dinámico
    let metodoPagoStr = (pago.metodo && String(pago.metodo).trim() !== "")
        ? String(pago.metodo).trim()
        : "Billetera Digital / Efectivo";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Método de pago:", marginX + 8, startY + 99);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(metodoPagoStr, marginX + 48, startY + 99);

    // Integración de etiqueta Estado con Badge PAGADO a la derecha
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Estado:", pageWidth - marginX - 35, startY + 99, { align: "right" });

    doc.setTextColor(6, 95, 70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("PAGADO", pageWidth - marginX - 18.5, startY + 99, { align: "center" });

    // Fecha de pago real inyectada en segunda fila
    const fechaPagoReal = pago.fecha_pago_real ? formatearFechaHora(pago.fecha_pago_real) : "-";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Fecha de pago:", marginX + 8, startY + 106);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(fechaPagoReal, marginX + 48, startY + 106);

    // =========================================================================
    // === CAJA DESTACADA DE MONTO TOTAL (Texto) ===
    // =========================================================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text("TOTAL CANCELADO:", marginX + 16, startY + 124.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129); // #10b981
    doc.text(`S/ ${parseFloat(pago.monto || 0).toFixed(2)}`, marginX + cardWidth - 16, startY + 124.5, { align: "right" });

    // =========================================================================
    // === LÍNEA DE FIRMA Y NOTA LEGAL (ALTO CONTRASTE) ===
    // =========================================================================
    // Línea de firma en la esquina inferior derecha
    doc.setDrawColor(150, 150, 150);
    doc.line(pageWidth - marginX - 50, doc.internal.pageSize.height - 25, pageWidth - marginX, doc.internal.pageSize.height - 25);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Recibí conforme / Firma", pageWidth - marginX - 25, doc.internal.pageSize.height - 20, { align: "center" });

    // Pie de página del comprobante (Disclaimer SUNAT)
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    const disclaimerSUNAT = "Nota: Este documento es estrictamente de control interno y representativo. No constituye un comprobante de pago electrónico válido para efectos tributarios ante la SUNAT.";
    const lineasDisclaimer = doc.splitTextToSize(disclaimerSUNAT, cardWidth - 14);
    doc.text(lineasDisclaimer, pageWidth / 2, startY + 141, { align: "center" });


    // 4. Descarga o Compartición
    let cleanNombre = nombreInquilino.replace(/[^a-zA-Z0-9_-]/g, '_');
    let nombreArchivo = `${idRecibo}_${cleanNombre}.pdf`;

    const isCapacitorNative = Boolean(
        typeof window !== 'undefined' &&
        window.Capacitor &&
        (
            (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
            (typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web') ||
            Boolean(window.Capacitor.Plugins?.Filesystem) ||
            Boolean(window.Capacitor.Plugins?.Share)
        )
    );

    if (isCapacitorNative) {
        guardarYCompartirPDFRecibo(doc, nombreArchivo, idRecibo, nombreInquilino);
    } else {
        doc.save(nombreArchivo);
    }
}

async function guardarYCompartirPDFRecibo(doc, nombreArchivo, idRecibo, nombreInquilino) {
    try {
        const Filesystem = window.Capacitor?.Plugins?.Filesystem;
        const Share = window.Capacitor?.Plugins?.Share;
        const dataUri = doc.output('datauristring');
        const base64Data = dataUri.split(',')[1];

        if (Filesystem?.writeFile) {
            const writeResult = await Filesystem.writeFile({
                path: nombreArchivo,
                data: base64Data,
                directory: 'CACHE'
            });

            if (Share?.share && writeResult?.uri) {
                await Share.share({
                    title: `Comprobante ${idRecibo}`,
                    text: `Comprobante de pago ${idRecibo} - ${nombreInquilino}`,
                    dialogTitle: 'Ver / Compartir Comprobante PDF',
                    files: [writeResult.uri]
                });
                return;
            }
        }
        doc.save(nombreArchivo);
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err || '');
        if (!/cancel/i.test(msg) && err?.name !== 'AbortError') {
            console.warn("Fallo en compartir nativo, ejecutando doc.save:", err);
            doc.save(nombreArchivo);
        }
    }
}

window.generarReciboPDF = generarReciboPDF;

// --- NUEVA FUNCIÓN: REVERTIR COBRO ---
function revertirPago(pagoId, nombre, monto) {
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let pObj = pagos.find(p => p.id === pagoId);
    let pago = {
        nombre: nombre || (pObj ? (pObj.nombre || pObj.historico) : 'Inquilino'),
        monto: monto !== undefined ? monto : (pObj ? pObj.monto : 0)
    };

    if (!confirm(`¿Revertir el pago de ${pago.nombre}? El saldo bajará S/ ${Number(pago.monto).toFixed(2)}`)) {
        return;
    }
    guardarSnapshot();
    let index = pagos.findIndex(p => p.id === pagoId);

        if (index !== -1) {
            const pagoRevertido = pagos[index];

            // Si es garantía, revertimos el estado en el perfil del cliente
            if (pagoRevertido.es_garantia) {
                let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
                let cIndex = clientes.findIndex(c => c.id === pagoRevertido.cliente_id);
                if (cIndex !== -1) {
                    clientes[cIndex].garantia_pagada = false;
                    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
                }
            }

            // 1. Regla de Búsqueda Universal al Revertir (Fase 3.4):
            // - cliente_id igual al del pago revertido
            // - es_garantia exactamente igual
            // - pagado === false
            // - Más reciente sin límite estricto de mes y año
            let deudasVinculadas = pagos.filter(p =>
                p.cliente_id === pagoRevertido.cliente_id &&
                Boolean(p.es_garantia) === Boolean(pagoRevertido.es_garantia) &&
                p.pagado === false
            );

            let deudaVinculada = deudasVinculadas.length > 0
                ? deudasVinculadas.reduce((prev, curr) => (curr.id > prev.id ? curr : prev), deudasVinculadas[0])
                : null;

            // 2. Fusión Matemática (Universal):
            if (deudaVinculada) {
                // Si se encuentra esa deuda: deuda.monto += pago_revertido.monto y elimina pago_revertido
                deudaVinculada.monto = parseFloat((parseFloat(deudaVinculada.monto || 0) + parseFloat(pagoRevertido.monto || 0)).toFixed(2));
                pagos.splice(index, 1);
            } else {
                // Si NO se encuentra deuda vinculada: cambia pagado = false
                pagoRevertido.pagado = false;
                pagoRevertido.metodo = "";
                delete pagoRevertido.id_recibo;
                delete pagoRevertido.fecha_emision;
                delete pagoRevertido.fecha_pago_real;
            }

            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));

            mostrarToastDeshacer(`Cobro de ${pago.nombre} revertido.`);
            renderizarDashboard();
            renderizarEstadisticas();
        }
}

function guardarNuevoCliente(e) {
    e.preventDefault();
    
    // 1. Capturar datos básicos
    let fechaInput = document.getElementById('cli-fecha-inicio').value;
    let partes = fechaInput.split('-');
    
    // 2. Capturar actividad o servicio (Fase 2.1 y Fase 3.6)
    let selectCatLegacy = document.getElementById('selectCategoriaPrincipal');
    let radioActividad = document.querySelector('input[name="tipo_actividad_servicio"]:checked');
    let tipoServicio = selectCatLegacy ? selectCatLegacy.value : (radioActividad ? radioActividad.value : 'alquiler');
    if (tipoServicio === 'nuevo_global' || tipoServicio === 'crear_nuevo') {
        let inputNuevaCatLegacy = document.getElementById('inputNuevaCategoriaGlobal');
        if (inputNuevaCatLegacy && inputNuevaCatLegacy.value.trim()) tipoServicio = inputNuevaCatLegacy.value.trim();
    }
    let esStreaming = tipoServicio === 'streaming';
    
    // 3. Capturar datos de la garantía (Solo para Alquiler)
    let tieneGarantia = (tipoServicio === 'alquiler' || tipoServicio === 'cuarto') && document.getElementById('chk-tiene-garantia') ? document.getElementById('chk-tiene-garantia').checked : false;
    let montoGarantia = tieneGarantia ? (parseFloat(document.getElementById('cli-garantia-monto').value) || 0) : 0;
    
    let radioGarPagada = document.getElementById('garantia-pagada-ahora');
    let chkGarPagada = document.getElementById('chk-garantia-pagada');
    let pagadaGarantia = false;
    if (radioGarPagada) {
        pagadaGarantia = radioGarPagada.checked;
    } else if (chkGarPagada) {
        pagadaGarantia = chkGarPagada.checked;
    }
    let fechaGarantia = tieneGarantia && document.getElementById('cli-garantia-fecha') ? document.getElementById('cli-garantia-fecha').value : "";

    // --- 🛡️ VALIDACIÓN DE SEGURIDAD ---
    if (tieneGarantia) {
        if (montoGarantia <= 0) {
            alert("⚠️ ¡Atención!\nHas indicado que aplica garantía, pero el monto es 0 o está vacío.");
            document.getElementById('cli-garantia-monto').focus();
            return; 
        }
        if (!pagadaGarantia && !fechaGarantia) {
            alert("⚠️ ¡Atención!\nHas indicado que hay una garantía pendiente, pero no has seleccionado la fecha de cobro.");
            document.getElementById('cli-garantia-fecha').focus();
            return; 
        }
    }

    // 4. Crear objeto del cliente (AQUÍ SE GUARDA EL TIPO DE SERVICIO)
    let nCli = {
        id: Date.now(),
        tipo_servicio: tipoServicio, // ¡Este es el dato que faltaba!
        nombre: document.getElementById('cli-nombre').value,
        apellido: document.getElementById('cli-apellido').value,
        telefono: document.getElementById('cli-telefono') ? document.getElementById('cli-telefono').value.trim() : "",
        monto: parseFloat(document.getElementById('cli-monto').value),
        fecha_inicio: fechaInput,
        dia: parseInt(partes[2]),
        ref: document.getElementById('cli-ref') ? document.getElementById('cli-ref').value : "",
        activo: true,
        garantia_monto: montoGarantia,
        garantia_pagada: pagadaGarantia,
        garantia_fecha: fechaGarantia
    };
    
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    clientes.push(nCli);
    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
    
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    
    // Capturar el método de pago seleccionado
    let metodoInputs = document.querySelectorAll('input[name="metodo_pago_inicial"]');
    let metodoSeleccionado = "Efectivo";
    for(let r of metodoInputs){
        if(r.checked){
            metodoSeleccionado = r.value;
            break;
        }
    }

    // Ingresar pago de garantía
    if (montoGarantia > 0 && pagadaGarantia) {
        pagos.push({
            id: Date.now(),
            fecha_pago_real: Date.now(),
            cliente_id: nCli.id,
            mes: mesActual,
            año: añoActual,
            monto: montoGarantia,
            pagado: true,
            metodo: metodoSeleccionado,
            historico: `${nCli.nombre} (Garantía)`.trim(),
            es_garantia: true,
            id_recibo: "REC-" + Date.now().toString().slice(-6),
            fecha_emision: formatearFechaHora(Date.now())
        });
    }

    // LÓGICA DE PAGO INICIAL (ALQUILER)
    let chkPagado = document.getElementById('chk-pago-inicial');
    if (chkPagado && chkPagado.checked) {
        let cuotasAdelantadas = parseInt(document.getElementById('cli-cuotas-adelanto').value) || 1;
        let mesBase = parseInt(partes[1]);
        let añoBase = parseInt(partes[0]);
        
        for (let i = 0; i < cuotasAdelantadas; i++) {
            let mesCobro = mesBase + i;
            let añoCobro = añoBase;
            while (mesCobro > 12) { mesCobro -= 12; añoCobro++; }

            let idPagoGen = Date.now() + i;
            pagos.push({
                id: idPagoGen,
                fecha_pago_real: Date.now(),
                cliente_id: nCli.id,
                mes: mesCobro,
                año: añoCobro,
                monto: nCli.monto,
                pagado: true,
                metodo: metodoSeleccionado,
                historico: `${nCli.nombre} ${nCli.apellido}`.trim(),
                id_recibo: "REC-" + idPagoGen.toString().slice(-6),
                fecha_emision: formatearFechaHora(idPagoGen)
            });
        }
    }
    localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
    
    generarDeudasDelMes();
    
    // Limpieza y Reseteo total del formulario
    document.getElementById('form-nuevo-cliente').reset();
    if(chkPagado) { chkPagado.checked = false; toggleMetodoPagoInicial(); }
    
    let chkTieneGar = document.getElementById('chk-tiene-garantia');
    if (chkTieneGar) {
        chkTieneGar.checked = false;
        toggleOpcionesGarantia();
    }
    
    // Reseteamos el switch superior de vuelta a "Cuarto"
    let radioCuarto = document.getElementById('tipo-cuarto');
    if (radioCuarto) { 
        radioCuarto.checked = true; 
        toggleTipoServicio(); 
    }
    
    navegar('dashboard');
}

let modalBajaInstancia = null;

// Reemplazamos la función antigua
function eliminarCliente(clienteId, nombre) {
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let cliente = clientes.find(c => c.id === clienteId);
    
    if (!cliente) return;

    let esStreaming = cliente.tipo_servicio === 'streaming';

    // 1. Configurar datos básicos
    document.getElementById('baja-cliente-id').value = clienteId;
    document.getElementById('baja-nombre-cliente').innerText = `${cliente.nombre} ${cliente.apellido || ''}`;

    // 2. Elementos del UI
    let tituloModal = document.getElementById('modal-baja-titulo');
    let tabPrincipal = document.getElementById('tab-baja-principal');
    let seccionProrrateo = document.getElementById('baja-seccion-prorrateo');
    let seccionStreaming = document.getElementById('baja-seccion-streaming');
    let seccionGarantia = document.getElementById('baja-seccion-garantia');
    let btnConfirmar = document.getElementById('btn-confirmar-baja');

    // 3. Transformación Camaleón
    if (esStreaming) {
        tituloModal.innerHTML = `<i class="fas fa-tv me-2"></i>Cancelar Suscripción`;
        tabPrincipal.innerHTML = `📺 Cortar Servicio`;
        seccionProrrateo.classList.add('d-none');
        seccionStreaming.classList.remove('d-none');
        seccionGarantia.classList.add('d-none');
        btnConfirmar.innerHTML = `<i class="fas fa-power-off me-2"></i>Confirmar Corte de Servicio`;
        btnConfirmar.className = "btn btn-dark w-100 fw-bold";
    } else {
        tituloModal.innerHTML = `<i class="fas fa-sign-out-alt me-2"></i>Retirar Inquilino`;
        tabPrincipal.innerHTML = `🚪 Dar de Baja (Mudanza)`;
        seccionProrrateo.classList.remove('d-none');
        seccionStreaming.classList.add('d-none');
        btnConfirmar.innerHTML = `<i class="fas fa-check-circle me-2"></i>Confirmar Retiro y Guardar`;
        btnConfirmar.className = "btn btn-primary w-100 fw-bold";

        // Cálculos de Prorrateo para Cuartos
        document.getElementById('baja-monto-normal').innerText = `S/ ${parseFloat(cliente.monto).toFixed(2)}`;
        let hoy = new Date();
        let diaActual = hoy.getDate();
        let diaCobro = cliente.dia;
        let diasUso = (diaActual >= diaCobro) ? (diaActual - diaCobro) : ((30 - diaCobro) + diaActual);
        if (diasUso === 0) diasUso = 1;

        document.getElementById('baja-dias-uso').innerText = `${diasUso} día(s)`;
        let prorrateo = (cliente.monto / 30) * diasUso;
        document.getElementById('baja-monto-cobrar').value = prorrateo.toFixed(2);

        // Lógica de Garantía
        if (cliente.garantia_pagada && cliente.garantia_monto > 0) {
            seccionGarantia.classList.remove('d-none');
            document.getElementById('baja-garantia-total').innerText = `S/ ${parseFloat(cliente.garantia_monto).toFixed(2)}`;
            document.getElementById('baja-garantia-descuento').value = 0;
            calcularGarantiaDevolver();
        } else {
            seccionGarantia.classList.add('d-none');
        }
    }

    if (!modalBajaInstancia) modalBajaInstancia = new bootstrap.Modal(document.getElementById('modalBajaCliente'));
    
    let triggerEl = document.querySelector('#modalBajaCliente button[data-bs-target="#tab-mudanza"]');
    bootstrap.Tab.getOrCreateInstance(triggerEl).show();
    
    modalBajaInstancia.show();
}

function calcularGarantiaDevolver() {
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let clienteId = parseInt(document.getElementById('baja-cliente-id').value);
    let cliente = clientes.find(c => c.id === clienteId);
    
    if (cliente) {
        let total = parseFloat(cliente.garantia_monto) || 0;
        let descuento = parseFloat(document.getElementById('baja-garantia-descuento').value) || 0;
        let devolver = total - descuento;
        if (devolver < 0) devolver = 0;
        document.getElementById('baja-garantia-devolver').innerText = `S/ ${devolver.toFixed(2)}`;
    }
}

// ==========================================
// --- MODAL DE BORRADO SELECTIVO ---
// ==========================================
let modalBorradoSelectivoInstancia = null;

function abrirModalBorradoSelectivo() {
    let chkRecibos = document.getElementById('del-chk-recibos');
    let chkEgresos = document.getElementById('del-chk-egresos');
    let chkApuntes = document.getElementById('del-chk-apuntes');
    let chkClientes = document.getElementById('del-chk-clientes');

    if (chkRecibos) chkRecibos.checked = false;
    if (chkEgresos) chkEgresos.checked = false;
    if (chkApuntes) chkApuntes.checked = false;
    if (chkClientes) chkClientes.checked = false;

    let modalEl = document.getElementById('modalBorradoSelectivo');
    if (!modalBorradoSelectivoInstancia && modalEl) {
        modalBorradoSelectivoInstancia = new bootstrap.Modal(modalEl);
    }
    if (modalBorradoSelectivoInstancia) {
        modalBorradoSelectivoInstancia.show();
    }
}

function ejecutarBorradoSelectivo() {
    let chkRecibos = document.getElementById('del-chk-recibos');
    let chkEgresos = document.getElementById('del-chk-egresos');
    let chkApuntes = document.getElementById('del-chk-apuntes');
    let chkClientes = document.getElementById('del-chk-clientes');
    let chkHabitaciones = document.getElementById('chkBorrarHabitaciones');
    let chkServicios = document.getElementById('chkBorrarServicios');

    let borrarRecibos = chkRecibos ? chkRecibos.checked : false;
    let borrarEgresos = chkEgresos ? chkEgresos.checked : false;
    let borrarApuntes = chkApuntes ? chkApuntes.checked : false;
    let borrarClientes = chkClientes ? chkClientes.checked : false;
    let borrarHabitaciones = chkHabitaciones ? chkHabitaciones.checked : false;
    let borrarServicios = chkServicios ? chkServicios.checked : false;

    if (!borrarRecibos && !borrarEgresos && !borrarApuntes && !borrarClientes && !borrarHabitaciones && !borrarServicios) {
        alert("⚠️ Selecciona al menos una categoría para eliminar.");
        return;
    }

    let modulos = [];
    if (borrarRecibos) modulos.push("• Historial de Recibos Pagados");
    if (borrarEgresos) modulos.push("• Historial de Egresos");
    if (borrarApuntes) modulos.push("• Mis Apuntes");
    if (borrarClientes) modulos.push("• Todos los Clientes y Deudas Pendientes");
    if (borrarHabitaciones) modulos.push("• Catálogo de Habitaciones");
    if (borrarServicios) modulos.push("• Catálogo de Servicios Frecuentes");

    let mensajeConfirm = "⚠️ ¿Confirmas la eliminación de los siguientes elementos?\n\n" + 
        modulos.join('\n') + 
        "\n\n(Podrás deshacer esta acción inmediatamente usando el Salvavidas).";

    if (!confirm(mensajeConfirm)) {
        return;
    }

    // 1. Guardar snapshot de seguridad antes de modificar nada (Gestión del Salvavidas Undo)
    guardarSnapshot();

    // 2. Ejecutar borrado según selección
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];

    if (borrarClientes && borrarRecibos) {
        localStorage.setItem('aldia_clientes', JSON.stringify([]));
        localStorage.setItem('aldia_pagos', JSON.stringify([]));
    } else if (borrarClientes) {
        localStorage.setItem('aldia_clientes', JSON.stringify([]));
        localStorage.setItem('aldia_pagos', JSON.stringify(pagos.filter(p => p.pagado === true)));
    } else if (borrarRecibos) {
        localStorage.setItem('aldia_pagos', JSON.stringify(pagos.filter(p => p.pagado === false)));
    }

    if (borrarEgresos) {
        localStorage.setItem('aldia_egresos', JSON.stringify([]));
    }

    if (borrarApuntes) {
        localStorage.setItem('aldia_apuntes', JSON.stringify([]));
    }

    // Lógica de eliminación de catálogos de inventario (Fase 3.1)
    if (borrarHabitaciones) {
        localStorage.setItem('aldia_habitaciones', JSON.stringify([]));
    }

    if (borrarServicios) {
        localStorage.setItem('aldia_servicios', JSON.stringify([]));
    }

    // 3. Cerrar modal si está abierto y limpiar checks
    if (modalBorradoSelectivoInstancia) {
        modalBorradoSelectivoInstancia.hide();
    }
    if (chkRecibos) chkRecibos.checked = false;
    if (chkEgresos) chkEgresos.checked = false;
    if (chkApuntes) chkApuntes.checked = false;
    if (chkClientes) chkClientes.checked = false;
    if (chkHabitaciones) chkHabitaciones.checked = false;
    if (chkServicios) chkServicios.checked = false;

    // 4. Mostrar aviso con opción de deshacer y actualizar interfaces
    mostrarToastDeshacer("Elementos eliminados correctamente.");

    renderizarDashboard();
    renderizarEstadisticas();
    if (typeof renderizarCalendario === 'function') renderizarCalendario();
    if (typeof renderizarApuntes === 'function') renderizarApuntes();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
}

// Funciones conservadas para retrocompatibilidad segura
function reiniciarTotales() {
    guardarSnapshot();
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    pagos = pagos.filter(p => p.pagado === false);
    localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
    mostrarToastDeshacer("Historial de recibos limpiado.");
    alert("✅ Historial limpiado exitosamente. Tu contador está en 0.");
    navegar('dashboard');
}

function borrarTodosLosClientes() {
    let confirmacion = confirm("🚨 ¡ADVERTENCIA EXTREMA! 🚨\n\n¿Estás absolutamente seguro de que quieres ELIMINAR A TODOS TUS CLIENTES?\n\nEsta acción borrará todas las deudas pendientes.");
    if (confirmacion) {
        guardarSnapshot();
        localStorage.setItem('aldia_clientes', JSON.stringify([]));
        let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
        let pagosHistoricos = pagos.filter(p => p.pagado === true);
        localStorage.setItem('aldia_pagos', JSON.stringify(pagosHistoricos));

        mostrarToastDeshacer("Todos los clientes eliminados.");
        alert("¡Limpieza completada! Todos los clientes han sido eliminados.");
        
        renderizarDashboard();
        renderizarCalendario();
    }
}

// --- RENDERIZADO DEL HISTORIAL AGRUPADO ---
// --- RENDERIZADO DEL HISTORIAL AGRUPADO (AHORA CON MÁS DETALLES) ---
// --- RENDERIZADO DEL HISTORIAL AGRUPADO (SIN TACHOS DE BASURA) ---
// --- RENDERIZADO DEL HISTORIAL AGRUPADO (SIN TACHOS DE BASURA) ---
// --- ESTADO Y TOGGLE INTERACTIVO DE FILTROS EN HISTORIAL FINANCIERO ---
let filtroTransacciones = 'todos'; // 'todos' | 'ingresos' | 'egresos'

function toggleFiltroTransacciones(tipo) {
    if (filtroTransacciones === tipo) {
        filtroTransacciones = 'todos';
    } else {
        filtroTransacciones = tipo;
    }
    actualizarEstilosCajasResumen();
    renderizarHistorial();
}

function actualizarEstilosCajasResumen() {
    const cardIng = document.getElementById('cardResumenIngresos');
    const cardEgr = document.getElementById('cardResumenEgresos');
    if (!cardIng || !cardEgr) return;

    if (filtroTransacciones === 'ingresos') {
        cardIng.style.opacity = '1';
        cardIng.style.transform = 'scale(1.02)';
        cardIng.style.border = '2.5px solid #198754';
        cardIng.style.boxShadow = '0 3px 8px rgba(25, 135, 84, 0.25)';
        cardIng.classList.remove('opacity-50');

        cardEgr.style.opacity = '0.5';
        cardEgr.style.transform = 'scale(0.98)';
        cardEgr.style.border = '1px solid #dc3545';
        cardEgr.style.boxShadow = 'none';
        cardEgr.classList.add('opacity-50');
    } else if (filtroTransacciones === 'egresos') {
        cardEgr.style.opacity = '1';
        cardEgr.style.transform = 'scale(1.02)';
        cardEgr.style.border = '2.5px solid #dc3545';
        cardEgr.style.boxShadow = '0 3px 8px rgba(220, 53, 69, 0.25)';
        cardEgr.classList.remove('opacity-50');

        cardIng.style.opacity = '0.5';
        cardIng.style.transform = 'scale(0.98)';
        cardIng.style.border = '1px solid #198754';
        cardIng.style.boxShadow = 'none';
        cardIng.classList.add('opacity-50');
    } else {
        // 'todos' / 'ambos'
        cardIng.style.opacity = '1';
        cardIng.style.transform = 'scale(1)';
        cardIng.style.border = '1px solid #198754';
        cardIng.style.boxShadow = 'none';
        cardIng.classList.remove('opacity-50');

        cardEgr.style.opacity = '1';
        cardEgr.style.transform = 'scale(1)';
        cardEgr.style.border = '1px solid #dc3545';
        cardEgr.style.boxShadow = 'none';
        cardEgr.classList.remove('opacity-50');
    }
}

function obtenerTipoFiltroHistorial() {
    if (filtroTransacciones === 'ingresos') return 'ingresos';
    if (filtroTransacciones === 'egresos') return 'egresos';
    return 'ambos';
}

window.filtroTransacciones = filtroTransacciones;
window.toggleFiltroTransacciones = toggleFiltroTransacciones;
window.actualizarEstilosCajasResumen = actualizarEstilosCajasResumen;
window.obtenerTipoFiltroHistorial = obtenerTipoFiltroHistorial;

function renderizarEstadisticas() {
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || []; 

    // Capturar y normalizar Filtro de Fecha (Fase 5.0)
    const inputMes = document.getElementById('filtroMesHistorial');
    let mesFiltro, anioFiltro;

    if (inputMes && inputMes.value) {
        const partes = inputMes.value.split('-').map(Number);
        anioFiltro = partes[0];
        mesFiltro = partes[1];
    } else {
        const hoy = new Date();
        anioFiltro = hoy.getFullYear();
        mesFiltro = hoy.getMonth() + 1;
        if (inputMes) {
            inputMes.value = `${anioFiltro}-${String(mesFiltro).padStart(2, '0')}`;
        }
    }

    // Capturar Filtro de Tipo (Controles Segmentados o fallback select)
    const tipoFiltro = obtenerTipoFiltroHistorial();

    let historialAgrupado = {};
    const keySeleccionada = `${anioFiltro}-${String(mesFiltro).padStart(2, '0')}`;
    historialAgrupado[keySeleccionada] = { mes: mesFiltro, año: anioFiltro, ingresos: [], egresos: [] };

    // 1. Filtrar y Agrupar Ingresos (Array COMPLETO del mes, inmutable para cálculo de totales)
    pagos.filter(p => {
        if (!p.pagado) return false;
        let pAnio = Number(p.año || p.ano);
        let pMes = Number(p.mes);
        if ((!pAnio || !pMes) && p.fecha_pago_real) {
            let f = new Date(Number(p.fecha_pago_real));
            if (!isNaN(f.getTime())) {
                pAnio = f.getFullYear();
                pMes = f.getMonth() + 1;
            }
        }
        return pAnio === anioFiltro && pMes === mesFiltro;
    }).forEach(pago => {
        // Buscar los detalles extra del cliente
        let cliente = clientes.find(c => c.id === pago.cliente_id);
        let tipoServicio = cliente ? cliente.tipo_servicio : 'cuarto';
        let icono = '<i class="fas fa-home"></i>';
        if (tipoServicio === 'streaming') icono = '<i class="fas fa-tv"></i>';
        else if (tipoServicio === 'academia') icono = '<i class="fas fa-graduation-cap"></i>';
        else if (tipoServicio === 'cochera') icono = '<i class="fas fa-car"></i>';
        else if (tipoServicio === 'servicio') icono = '<i class="fas fa-concierge-bell"></i>';

        let referencia = (cliente && cliente.ref) ? cliente.ref : (tipoServicio === 'streaming' ? 'Streaming' : 'General');
        let colorBadge = tipoServicio === 'streaming' ? 'bg-dark text-white' : 'bg-primary bg-opacity-10 text-primary';
        let badgeHtml = `<span class="badge ${colorBadge} rounded-pill ms-2" style="font-size: 0.65rem;">${icono} ${referencia}</span>`;

        // Extraer la Fecha y Hora exactas para TODOS los ingresos (prioridad a fecha_pago_real)
        const timestampBase = pago.fecha_pago_real ? pago.fecha_pago_real : pago.id;
        let fechaStr = formatearFechaHora(timestampBase);

        historialAgrupado[keySeleccionada].ingresos.push({ 
            id: pago.id, 
            tipo: 'ingreso', 
            desc: pago.historico, 
            badge: badgeHtml,
            monto: pago.monto, 
            metodo: pago.metodo, 
            fechaStr: fechaStr,
            timestampReal: Number(pago.fecha_pago_real || pago.id),
            id_recibo: pago.id_recibo || ''
        });
    });

    // 2. Filtrar y Agrupar Egresos (Array COMPLETO del mes, inmutable para cálculo de totales)
    egresos.forEach(egr => {
        let d, m, y;
        if (egr.fecha && typeof egr.fecha === 'string' && egr.fecha.includes('-')) {
            let partes = egr.fecha.split('-');
            y = Number(partes[0]);
            m = Number(partes[1]);
            d = String(partes[2]).padStart(2, '0');
        } else {
            d = String(egr.dia || '01').padStart(2, '0');
            m = Number(egr.mes || mesFiltro);
            y = Number(egr.año || anioFiltro);
        }

        if (y === anioFiltro && m === mesFiltro) {
            let hrs = "00";
            let mins = "00";
            const dateId = new Date(Number(egr.id));
            if (egr.id && !isNaN(dateId.getTime()) && Number(egr.id) > 1000000000000) {
                hrs = dateId.getHours().toString().padStart(2, '0');
                mins = dateId.getMinutes().toString().padStart(2, '0');
            }

            let fechaStrEgr = `${d}/${String(m).padStart(2, '0')}/${y}, ${hrs}:${mins}`;

            let timestampEgreso = Number(egr.id);
            if (egr.fecha) {
                const partesFecha = egr.fecha.split('-').map(Number);
                if (partesFecha.length === 3) {
                    const fechaBaseId = new Date(Number(egr.id));
                    const hrsB = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getHours() : 0;
                    const minsB = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getMinutes() : 0;
                    const secsB = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getSeconds() : 0;
                    timestampEgreso = new Date(partesFecha[0], partesFecha[1] - 1, partesFecha[2], hrsB, minsB, secsB).getTime();
                }
            }

            historialAgrupado[keySeleccionada].egresos.push({ 
                id: egr.id, 
                tipo: 'egreso', 
                desc: egr.motivo, 
                monto: egr.monto, 
                fechaStr: fechaStrEgr, 
                timestampReal: timestampEgreso 
            });
        }
    });

    // CÁLCULO INMUTABLE DEL SALDO NETO Y TOTALES SOBRE EL MES COMPLETO
    let dataMes = historialAgrupado[keySeleccionada];
    let sumaIngresos = dataMes.ingresos.reduce((sum, item) => sum + parseFloat(item.monto || 0), 0);
    let sumaEgresos = dataMes.egresos.reduce((sum, item) => sum + parseFloat(item.monto || 0), 0);
    let neto = sumaIngresos - sumaEgresos;

    dataMes.ingresos.sort((a, b) => b.timestampReal - a.timestampReal);
    dataMes.egresos.sort((a, b) => b.timestampReal - a.timestampReal);

    // --- FILTRO DE BÚSQUEDA EN TIEMPO REAL (Buscador de Auditoría) ---
    const inputBuscador = document.getElementById('buscadorHistorial');
    const queryBusqueda = (inputBuscador ? inputBuscador.value : '').trim().toLowerCase();

    let ingresosAMostrar = dataMes.ingresos;
    let egresosAMostrar = dataMes.egresos;

    if (queryBusqueda) {
        ingresosAMostrar = dataMes.ingresos.filter(ing => {
            const desc = (ing.desc || '').toLowerCase();
            const idRec = (ing.id_recibo || '').toLowerCase();
            const met = (ing.metodo || '').toLowerCase();
            return desc.includes(queryBusqueda) || idRec.includes(queryBusqueda) || met.includes(queryBusqueda);
        });
        egresosAMostrar = dataMes.egresos.filter(egr => {
            const desc = (egr.desc || '').toLowerCase();
            return desc.includes(queryBusqueda);
        });
    }

    // Coincidencias de auditoría en otros periodos cuando se usa el buscador
    let otrosIngresosCoincidentes = [];
    if (queryBusqueda) {
        pagos.forEach(p => {
            if (!p.pagado) return;
            let pAnio = Number(p.año || p.ano);
            let pMes = Number(p.mes);
            if ((!pAnio || !pMes) && p.fecha_pago_real) {
                let f = new Date(Number(p.fecha_pago_real));
                if (!isNaN(f.getTime())) {
                    pAnio = f.getFullYear();
                    pMes = f.getMonth() + 1;
                }
            }
            if (pAnio === anioFiltro && pMes === mesFiltro) return;

            const descP = (p.historico || '').toLowerCase();
            const idReciboP = (p.id_recibo || '').toLowerCase();
            const metodoP = (p.metodo || '').toLowerCase();

            if (descP.includes(queryBusqueda) || idReciboP.includes(queryBusqueda) || metodoP.includes(queryBusqueda)) {
                let cliente = clientes.find(c => c.id === p.cliente_id);
                let tipoServicio = cliente ? cliente.tipo_servicio : 'cuarto';
                let referencia = (cliente && cliente.ref) ? cliente.ref : (tipoServicio === 'streaming' ? 'Streaming' : 'General');
                let badgeHtml = `<span class="badge bg-secondary bg-opacity-10 text-secondary rounded-pill ms-2" style="font-size: 0.65rem;">${referencia}</span>`;

                const timestampBase = p.fecha_pago_real ? p.fecha_pago_real : p.id;
                let fechaStr = formatearFechaHora(timestampBase);

                otrosIngresosCoincidentes.push({
                    id: p.id,
                    tipo: 'ingreso',
                    desc: p.historico,
                    badge: badgeHtml,
                    monto: p.monto,
                    metodo: p.metodo,
                    fechaStr: fechaStr,
                    timestampReal: Number(p.fecha_pago_real || p.id),
                    id_recibo: p.id_recibo || 'Sin Código',
                    periodoStr: `${String(pMes).padStart(2, '0')}/${pAnio}`
                });
            }
        });
        otrosIngresosCoincidentes.sort((a, b) => b.timestampReal - a.timestampReal);
    }

    // Preparar elementos a mostrar según el filtro activo (Títulos Dinámicos y Botonera Apilada)
    let itemsFinales = [];
    let tituloFiltro = "";

    if (tipoFiltro === 'ingresos') {
        itemsFinales = ingresosAMostrar.map(item => ({ ...item, subTipo: 'ingreso' }));
        tituloFiltro = `INGRESOS REGISTRADOS (${itemsFinales.length}${queryBusqueda ? ' encontrados' : ''})`;
    } else if (tipoFiltro === 'egresos') {
        itemsFinales = egresosAMostrar.map(item => ({ ...item, subTipo: 'egreso' }));
        tituloFiltro = `EGRESOS REGISTRADOS (${itemsFinales.length}${queryBusqueda ? ' encontrados' : ''})`;
    } else {
        // 'todos' / 'ambos'
        itemsFinales = [
            ...ingresosAMostrar.map(item => ({ ...item, subTipo: 'ingreso' })),
            ...egresosAMostrar.map(item => ({ ...item, subTipo: 'egreso' }))
        ];
        itemsFinales.sort((a, b) => b.timestampReal - a.timestampReal);
        tituloFiltro = `MOVIMIENTOS REGISTRADOS (${itemsFinales.length}${queryBusqueda ? ' encontrados' : ''})`;
    }

    let listaItemsHtml = "";

    // Título unificado y estabilizado (Anti-Salto)
    listaItemsHtml += `
    <div class="d-flex align-items-center mb-2 px-1" style="min-height: 2rem;">
        <h6 class="text-muted small fw-bold m-0 text-uppercase">${tituloFiltro}</h6>
    </div>`;

    if (itemsFinales.length > 0) {
        itemsFinales.forEach(item => {
            if (item.subTipo === 'ingreso') {
                let idReciboTexto = (item.id_recibo && String(item.id_recibo).trim() !== '' && item.id_recibo !== 'Sin Código') 
                    ? `<span class="badge bg-light text-secondary border fw-normal" style="font-size:0.68rem;"><i class="fas fa-receipt me-1 text-muted"></i>${item.id_recibo}</span>`
                    : `<span class="badge bg-light text-muted border fw-normal" style="font-size:0.68rem;">Sin Código</span>`;

                listaItemsHtml += `
                <div class="bg-white p-2 mb-2 rounded shadow-sm border-start border-4 border-success d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1 overflow-hidden pe-2" style="min-width: 0;">
                        <div class="d-flex align-items-center mb-1 flex-wrap gap-1">
                            <span class="fw-bold text-dark text-truncate" style="max-width: 100%;" title="${item.desc}">${item.desc}</span>
                            ${item.badge || ''}
                            ${idReciboTexto}
                        </div>
                        <small class="text-muted d-block" style="font-size:0.7rem;"><i class="far fa-calendar-check me-1"></i>Pagado el ${item.fechaStr}</small>
                        <small class="text-muted d-block" style="font-size:0.7rem;"><i class="fas fa-wallet me-1"></i>Ingreso por ${item.metodo}</small>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-shrink-0">
                        <span class="text-success fw-bold small text-nowrap">+ S/ ${parseFloat(item.monto).toFixed(2)}</span>
                        <div class="d-flex flex-column gap-2">
                            <button class="btn btn-sm btn-outline-danger rounded-3" style="width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="generarReciboPDF(${item.id})" title="Ver PDF"><i class="fas fa-file-pdf" style="font-size: 0.85rem;"></i></button>
                            <button class="btn btn-sm btn-outline-danger rounded-3" style="width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="eliminarPagoHistorial(${item.id})" title="Eliminar registro"><i class="fas fa-trash-alt" style="font-size: 0.85rem;"></i></button>
                        </div>
                    </div>
                </div>`;
            } else {
                // Egreso
                listaItemsHtml += `
                <div class="bg-white p-2 mb-2 rounded shadow-sm border-start border-4 border-danger d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1 overflow-hidden pe-2" style="min-width: 0;">
                        <span class="fw-bold text-dark d-block mb-1 text-truncate" title="${item.desc}">${item.desc}</span>
                        <small class="text-muted d-block" style="font-size:0.7rem;"><i class="far fa-calendar-minus me-1"></i>Egreso el ${item.fechaStr}</small>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-shrink-0">
                        <span class="text-danger fw-bold small text-nowrap">- S/ ${parseFloat(item.monto).toFixed(2)}</span>
                        <div class="d-flex flex-column gap-2">
                            <button class="btn btn-sm btn-outline-danger rounded-3" style="width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="eliminarEgresoHistorial(${item.id})" title="Eliminar registro"><i class="fas fa-trash-alt" style="font-size: 0.85rem;"></i></button>
                        </div>
                    </div>
                </div>`;
            }
        });
    } else {
        let msgVacio = 'No hay registros en este mes.';
        if (queryBusqueda) {
            msgVacio = `No se encontraron registros que coincidan con "<strong>${queryBusqueda}</strong>".`;
        } else if (tipoFiltro === 'ingresos') {
            msgVacio = 'No hay ingresos registrados en este mes.';
        } else if (tipoFiltro === 'egresos') {
            msgVacio = 'No hay egresos registrados en este mes.';
        }
        listaItemsHtml += `
        <div class="d-flex align-items-center justify-content-center text-muted small py-4" style="min-height: 2rem;">
            <i class="fas fa-info-circle me-1"></i>${msgVacio}
        </div>`;
    }

    // Renderizar coincidencias en otros periodos (si existen)
    if (otrosIngresosCoincidentes.length > 0) {
        listaItemsHtml += `
        <div class="d-flex align-items-center mb-2 mt-3 px-1" style="min-height: 2rem;">
            <h6 class="text-primary small fw-bold m-0 text-uppercase"><i class="fas fa-search me-1"></i>Coincidencias en otros periodos (${otrosIngresosCoincidentes.length})</h6>
        </div>`;
        otrosIngresosCoincidentes.forEach(ing => {
            let idReciboTexto = (ing.id_recibo && String(ing.id_recibo).trim() !== '' && ing.id_recibo !== 'Sin Código') 
                ? `<span class="badge bg-light text-secondary border fw-normal" style="font-size:0.68rem;"><i class="fas fa-receipt me-1 text-muted"></i>${ing.id_recibo}</span>`
                : `<span class="badge bg-light text-muted border fw-normal" style="font-size:0.68rem;">Sin Código</span>`;

            listaItemsHtml += `
            <div class="bg-white p-2 mb-2 rounded shadow-sm border-start border-4 border-primary d-flex justify-content-between align-items-center">
                <div class="flex-grow-1 overflow-hidden pe-2" style="min-width: 0;">
                    <div class="d-flex align-items-center mb-1 flex-wrap gap-1">
                        <span class="fw-bold text-dark text-truncate" style="max-width: 100%;" title="${ing.desc}">${ing.desc}</span>
                        <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill" style="font-size: 0.65rem;">Periodo: ${ing.periodoStr}</span>
                        ${ing.badge}
                        ${idReciboTexto}
                    </div>
                    <small class="text-muted d-block" style="font-size:0.7rem;"><i class="far fa-calendar-check me-1"></i>Pagado el ${ing.fechaStr}</small>
                    <small class="text-muted d-block" style="font-size:0.7rem;"><i class="fas fa-wallet me-1"></i>Ingreso por ${ing.metodo}</small>
                </div>
                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                    <span class="text-success fw-bold small text-nowrap">+ S/ ${parseFloat(ing.monto).toFixed(2)}</span>
                    <div class="d-flex flex-column gap-2">
                        <button class="btn btn-sm btn-outline-danger rounded-3" style="width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="generarReciboPDF(${ing.id})" title="Ver PDF"><i class="fas fa-file-pdf" style="font-size: 0.85rem;"></i></button>
                    </div>
                </div>
            </div>`;
        });
    }

    if (queryBusqueda && ingresosAMostrar.length === 0 && egresosAMostrar.length === 0 && otrosIngresosCoincidentes.length === 0) {
        listaItemsHtml = `<div class="text-center text-muted py-4 small" style="min-height: 2rem;"><i class="fas fa-search me-1"></i>No se encontraron recibos ni registros que coincidan con "<strong>${queryBusqueda}</strong>".</div>`;
    } else if (!queryBusqueda && tipoFiltro === 'ambos' && dataMes.ingresos.length === 0 && dataMes.egresos.length === 0) {
        listaItemsHtml = `<div class="text-center text-muted py-3 small" style="min-height: 2rem;"><i class="fas fa-info-circle me-1"></i>No hay ingresos ni egresos registrados en este mes.</div>`;
    }

    // Forzar fecha del selector a español estricto ("OCTUBRE 2026")
    const fechaObjMes = new Date(Number(anioFiltro), Number(mesFiltro) - 1, 1);
    const formatoEspanol = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' });
    const textoMesEspanol = formatoEspanol.format(fechaObjMes).toUpperCase().replace(/\bDE\b/g, '').replace(/\s+/g, ' ').trim();

    // Actualizar Encabezado Interno (Mes/Año y Neto)
    const elTextoMes = document.getElementById('historial-nombre-mes');
    if (elTextoMes) {
        elTextoMes.textContent = textoMesEspanol;
    }
    const elBadgeNeto = document.getElementById('badgeNetoSuperior') || document.getElementById('historial-badge-neto');
    if (elBadgeNeto) {
        elBadgeNeto.textContent = `Neto: S/ ${neto.toFixed(2)}`;
        elBadgeNeto.className = `badge ${neto >= 0 ? 'bg-success' : 'bg-danger'} py-2 px-3 fs-6 rounded-pill`;
    }

    // Actualizar montos en las tarjetas de resumen
    const elResumenIng = document.getElementById('total-resumen-ingresos');
    if (elResumenIng) elResumenIng.textContent = `S/ ${sumaIngresos.toFixed(2)}`;
    const elResumenEgr = document.getElementById('total-resumen-egresos');
    if (elResumenEgr) elResumenEgr.textContent = `S/ ${sumaEgresos.toFixed(2)}`;

    // Garantizar que ambas cajas permanezcan visibles en col-6 para funcionar como botones de filtrado interactivo
    const colResumenIngresos = document.getElementById('colResumenIngresos');
    const colResumenEgresos = document.getElementById('colResumenEgresos');

    if (colResumenIngresos && colResumenEgresos) {
        colResumenIngresos.classList.remove('d-none', 'col-12');
        colResumenIngresos.classList.add('col-6');
        colResumenEgresos.classList.remove('d-none', 'col-12');
        colResumenEgresos.classList.add('col-6');
        if (elBadgeNeto) elBadgeNeto.classList.remove('d-none');
    }
    actualizarEstilosCajasResumen();

    // Inyectar lista de registros directamente en lista-historial-agrupado
    const contenedorHistorial = document.getElementById('lista-historial-agrupado');
    if (contenedorHistorial) {
        contenedorHistorial.innerHTML = listaItemsHtml;
    }
}

function renderizarHistorial() {
    renderizarEstadisticas();
}
window.renderizarEstadisticas = renderizarEstadisticas;
window.renderizarHistorial = renderizarHistorial;

// --- LISTENERS DE FILTROS EN HISTORIAL FINANCIERO (Controles Consolidados) ---
function iniciarListenersHistorial() {
    const inputMes = document.getElementById('filtroMesHistorial');
    if (inputMes) {
        inputMes.addEventListener('change', renderizarHistorial);
    }

    const inputBuscador = document.getElementById('buscadorHistorial');
    if (inputBuscador) {
        inputBuscador.addEventListener('input', renderizarHistorial);
    }

    actualizarEstilosCajasResumen();
    // Renderizado inicial al arrancar
    renderizarHistorial();
}
window.iniciarListenersHistorial = iniciarListenersHistorial;

// --- RENDERIZADO DEL CALENDARIO (AGENDA) ---
function renderizarCalendario() {
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    
    document.getElementById('calendario-mes-titulo').innerText = `${meses[mesActual - 1]} ${añoActual}`;
    
    let agendaArray = [];
    let diaHoy = hoy.getDate();

    clientes.forEach(cli => {
        if (cli.activo) {
            let pago = pagos.find(p => p.cliente_id === cli.id && p.mes === mesActual && p.año === añoActual);
            if (pago) {
                let estado = pago.pagado ? 'pagado' : 'pendiente';
                if (!pago.pagado && cli.dia < diaHoy) estado = 'atrasado';
                if (!pago.pagado && cli.dia === diaHoy) estado = 'hoy';
                
                agendaArray.push({
                    dia: cli.dia,
                    nombre: `${cli.nombre} ${cli.apellido}`,
                    monto: pago.monto,
                    estado: estado
                });
            }
        }
    });

    // Ordenar de menor a mayor (Del día 1 al 31)
    agendaArray.sort((a, b) => a.dia - b.dia);

    let htmlAgenda = "";
    if (agendaArray.length === 0) {
        htmlAgenda = '<div class="text-center text-white-50 my-5"><p>No hay cobros programados.</p></div>';
    } else {
        agendaArray.forEach(item => {
            let icono, colorBorde, colorTexto, descEstado;

            if (item.estado === 'pagado') {
                icono = '<i class="fas fa-check-circle text-success fs-3"></i>';
                colorBorde = 'border-success'; colorTexto = 'text-success'; descEstado = 'Pagado';
            } else if (item.estado === 'atrasado') {
                icono = '<i class="fas fa-exclamation-circle text-danger fs-3"></i>';
                colorBorde = 'border-danger'; colorTexto = 'text-danger fw-bold'; descEstado = 'Atrasado';
            } else if (item.estado === 'hoy') {
                icono = '<i class="fas fa-clock text-warning fs-3"></i>';
                colorBorde = 'border-warning'; colorTexto = 'text-warning fw-bold'; descEstado = 'Vence Hoy';
            } else {
                icono = '<i class="fas fa-hourglass-half text-secondary fs-3"></i>';
                colorBorde = 'border-secondary'; colorTexto = 'text-muted'; descEstado = 'Pendiente';
            }

            htmlAgenda += `
            <div class="card-custom p-3 shadow-sm mb-3 border-start border-4 ${colorBorde}">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-3">
                        <div class="text-center rounded bg-light p-2" style="min-width: 55px;">
                            <small class="d-block text-muted" style="font-size: 0.65rem; font-weight: bold;">DÍA</small>
                            <span class="fs-4 fw-bold text-dark lh-1">${item.dia}</span>
                        </div>
                        <div>
                            <h6 class="mb-0 fw-bold text-dark" style="font-size: 1.1rem;">${item.nombre}</h6>
                            <small class="${colorTexto}">${descEstado} • S/ ${parseFloat(item.monto).toFixed(2)}</small>
                        </div>
                    </div>
                    <div>${icono}</div>
                </div>
            </div>`;
        });
    }

    document.getElementById('lista-agenda').innerHTML = htmlAgenda;
}

// ==========================================
// --- LÓGICA DE APUNTES (Estilo Keep) ---
// ==========================================

// ==========================================
// --- LÓGICA DE APUNTES (Estilo Keep Flexible) ---
// ==========================================
let modalApunteInstancia = null;

function crearNuevoApunte() {
    document.getElementById('nuevo-apunte-titulo').value = '';
    document.getElementById('tipo_simple').checked = true; // Por defecto simple
    if(!modalApunteInstancia) modalApunteInstancia = new bootstrap.Modal(document.getElementById('modalNuevoApunte'));
    modalApunteInstancia.show();
}

function guardarNuevoApunte() {
    let titulo = document.getElementById('nuevo-apunte-titulo').value.trim();
    if (!titulo) {
        alert("Por favor, ingresa un nombre para la lista");
        return;
    }

    let tipo = document.querySelector('input[name="tipo_apunte"]:checked').value;
    let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    
    apuntes.push({
        id: Date.now(),
        titulo: titulo,
        tipo: tipo, // Guardamos si es "simple" o "cuentas"
        items: []
    });
    
    localStorage.setItem('aldia_apuntes', JSON.stringify(apuntes));
    modalApunteInstancia.hide();
    renderizarApuntes();
}

function renderizarApuntes() {
    let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    let html = "";
    
    if (apuntes.length === 0) {
        html = '<div class="text-center text-white-50 my-5"><i class="fas fa-clipboard-list fs-1 mb-3"></i><p>Aún no tienes listas de apuntes.</p></div>';
    } else {
        apuntes.slice().reverse().forEach(apunte => {
            let itemsHtml = "";
            let totalSuma = 0;
            let esCuentas = apunte.tipo !== 'simple'; 

            apunte.items.forEach(item => {
                let tachado = item.chequeado ? 'text-decoration-line-through text-muted' : 'text-dark fw-bold';
                let checkIcon = item.chequeado ? 'fa-check-square text-success' : 'fa-square text-muted';
                
                let infoExtraHtml = "";
                
                if (esCuentas) {
                    let cantidad = item.cantidad || 1;
                    let valor = item.valor || 0;
                    let subtotal = cantidad * valor;
                    if (item.chequeado) totalSuma += subtotal;
                    
                    let textoCant = cantidad > 1 ? `<small class="text-muted me-1">${cantidad}x</small>` : '';
                    infoExtraHtml = `<span class="${tachado}" style="min-width: 70px; text-align: right;">${textoCant}S/ ${subtotal.toFixed(2)}</span>`;
                }

                // Aquí conectamos el lápiz con el nuevo Modal
                itemsHtml += `
                <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                    <div class="d-flex align-items-center gap-2 overflow-hidden" onclick="toggleCheckItem(${apunte.id}, ${item.id})" style="cursor: pointer; flex-grow: 1;">
                        <i class="far ${checkIcon} fs-4"></i>
                        <span class="${tachado} text-truncate" style="font-size: 0.95rem;">${item.texto}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        ${infoExtraHtml}
                        <button class="btn btn-link text-primary p-0 ms-2" onclick="abrirModalEditarItem(${apunte.id}, ${item.id}, ${esCuentas})" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-link text-danger p-0 ms-2" onclick="eliminarItemApunte(${apunte.id}, ${item.id})" title="Borrar"><i class="fas fa-times"></i></button>
                    </div>
                </div>`;
            });
            
            let formIngresoHtml = "";
            if (esCuentas) {
                formIngresoHtml = `
                <form onsubmit="agregarItemApunte(event, ${apunte.id}, 'cuentas')" class="d-flex gap-2 mb-3 mt-3">
                    <input type="text" id="nuevo-texto-${apunte.id}" class="form-control form-control-sm bg-light border-0" placeholder="Ej: Gaseosa" required style="flex-grow: 1;">
                    <input type="number" step="1" min="1" id="nuevo-cant-${apunte.id}" class="form-control form-control-sm bg-light border-0 px-1 text-center" placeholder="Cant" style="width: 50px;">
                    <input type="number" step="0.01" id="nuevo-valor-${apunte.id}" class="form-control form-control-sm bg-light border-0 px-1" placeholder="S/ Precio" style="width: 70px;" required>
                    <button type="submit" class="btn btn-sm btn-success rounded-circle" style="width: 30px; height: 30px; padding: 0; flex-shrink: 0;"><i class="fas fa-plus"></i></button>
                </form>`;
            } else {
                formIngresoHtml = `
                <form onsubmit="agregarItemApunte(event, ${apunte.id}, 'simple')" class="d-flex gap-2 mb-3 mt-3">
                    <input type="text" id="nuevo-texto-${apunte.id}" class="form-control form-control-sm bg-light border-0" placeholder="Añadir apunte..." required>
                    <button type="submit" class="btn btn-sm btn-success rounded-circle" style="width: 30px; height: 30px; padding: 0; flex-shrink: 0;"><i class="fas fa-plus"></i></button>
                </form>`;
            }
            
            let totalHtml = esCuentas ? `
                <div class="text-end border-top pt-2 mt-2">
                    <small class="text-muted text-uppercase fw-bold" style="font-size: 0.7rem;">Suma de marcados:</small>
                    <h4 class="text-success fw-bold m-0 lh-1">S/ ${totalSuma.toFixed(2)}</h4>
                </div>` : '';

            let iconoTitulo = esCuentas ? 'fa-calculator' : 'fa-list-ul';

            // REUBICACIÓN: El doble check ahora es un botón a la izquierda, encima de los ítems
            html += `
            <div class="card-custom p-3 shadow-sm mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex align-items-center gap-2">
                        <i class="fas ${iconoTitulo} text-primary" style="font-size: 0.9rem;"></i>
                        <h5 class="fw-bold text-primary m-0 text-uppercase" style="font-size: 1.1rem;">${apunte.titulo}</h5>
                    </div>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="eliminarApunte(${apunte.id})" title="Borrar lista completa"><i class="fas fa-trash fs-5"></i></button>
                </div>
                
                <div class="d-flex align-items-center mb-3 pb-2 border-bottom">
                    <button class="btn btn-sm btn-link text-success p-0 text-decoration-none d-flex align-items-center gap-2" onclick="toggleTodosApunte(${apunte.id})" title="Marcar/Desmarcar todos">
                        <i class="fas fa-check-double fs-4"></i> <span class="fw-bold small text-dark">Check General</span>
                    </button>
                </div>

                <div class="mb-2">
                    ${itemsHtml}
                </div>
                
                ${formIngresoHtml}
                ${totalHtml}
            </div>`;
        });
    }
    
    document.getElementById('contenedor-apuntes').innerHTML = html;
}

function agregarItemApunte(e, apunteId, tipo) {
    e.preventDefault();
    let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    let index = apuntes.findIndex(a => a.id === apunteId);
    
    if (index !== -1) {
        let texto = document.getElementById(`nuevo-texto-${apunteId}`).value;
        let nuevoItem = { id: Date.now(), texto: texto, chequeado: false };

        if (tipo === 'cuentas') {
            let cantInput = document.getElementById(`nuevo-cant-${apunteId}`).value;
            let valor = document.getElementById(`nuevo-valor-${apunteId}`).value;
            
            // Si deja la cantidad vacía, asume 1 por defecto
            nuevoItem.cantidad = cantInput && parseInt(cantInput) > 0 ? parseInt(cantInput) : 1;
            nuevoItem.valor = parseFloat(valor);
        }

        apuntes[index].items.push(nuevoItem);
        localStorage.setItem('aldia_apuntes', JSON.stringify(apuntes));
        renderizarApuntes();
    }
}

function toggleCheckItem(apunteId, itemId) {
    let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    let aIndex = apuntes.findIndex(a => a.id === apunteId);
    if (aIndex !== -1) {
        let iIndex = apuntes[aIndex].items.findIndex(i => i.id === itemId);
        if (iIndex !== -1) {
            apuntes[aIndex].items[iIndex].chequeado = !apuntes[aIndex].items[iIndex].chequeado;
            localStorage.setItem('aldia_apuntes', JSON.stringify(apuntes));
            renderizarApuntes();
        }
    }
}

function eliminarItemApunte(apunteId, itemId) {
    let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    let aIndex = apuntes.findIndex(a => a.id === apunteId);
    if (aIndex !== -1) {
        apuntes[aIndex].items = apuntes[aIndex].items.filter(i => i.id !== itemId);
        localStorage.setItem('aldia_apuntes', JSON.stringify(apuntes));
        renderizarApuntes();
    }
}

function eliminarApunte(apunteId) {
    if (confirm("¿Seguro que quieres borrar toda esta lista?")) {
        let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
        apuntes = apuntes.filter(a => a.id !== apunteId);
        localStorage.setItem('aldia_apuntes', JSON.stringify(apuntes));
        renderizarApuntes();
    }
}

// --- NUEVA FUNCIÓN: MARCAR / DESMARCAR TODOS ---
function toggleTodosApunte(apunteId) {
    let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    let aIndex = apuntes.findIndex(a => a.id === apunteId);
    
    if (aIndex !== -1) {
        let apunte = apuntes[aIndex];
        
        // Verificamos si TODOS ya están marcados
        let todosMarcados = apunte.items.length > 0 && apunte.items.every(i => i.chequeado);
        
        // Si todos están marcados, los desmarcamos. Si no, los marcamos todos.
        apunte.items.forEach(i => i.chequeado = !todosMarcados);
        
        localStorage.setItem('aldia_apuntes', JSON.stringify(apuntes));
        renderizarApuntes();
    }
}

// --- NUEVAS FUNCIONES PARA EDITAR CON MODAL ---
let modalEditarItemInstancia = null;

function abrirModalEditarItem(apunteId, itemId, esCuentas) {
    let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    let apunte = apuntes.find(a => a.id === apunteId);
    if (!apunte) return;
    
    let item = apunte.items.find(i => i.id === itemId);
    if (!item) return;

    // Llenar los datos ocultos
    document.getElementById('edit-apunte-id').value = apunteId;
    document.getElementById('edit-item-id').value = itemId;
    document.getElementById('edit-es-cuentas').value = esCuentas;

    // Llenar los campos visuales
    document.getElementById('edit-item-texto').value = item.texto;

    let containerCuentas = document.getElementById('edit-item-cuentas-container');
    if (esCuentas) {
        containerCuentas.classList.remove('d-none');
        document.getElementById('edit-item-cant').value = item.cantidad || 1;
        document.getElementById('edit-item-valor').value = item.valor || 0;
    } else {
        containerCuentas.classList.add('d-none'); // Ocultar si es lista simple
    }

    if (!modalEditarItemInstancia) {
        modalEditarItemInstancia = new bootstrap.Modal(document.getElementById('modalEditarItem'));
    }
    modalEditarItemInstancia.show();
}

function guardarEdicionItem() {
    let apunteId = parseInt(document.getElementById('edit-apunte-id').value);
    let itemId = parseInt(document.getElementById('edit-item-id').value);
    let esCuentas = document.getElementById('edit-es-cuentas').value === 'true';

    let apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    let aIndex = apuntes.findIndex(a => a.id === apunteId);
    
    if (aIndex !== -1) {
        let iIndex = apuntes[aIndex].items.findIndex(i => i.id === itemId);
        if (iIndex !== -1) {
            let nuevoTexto = document.getElementById('edit-item-texto').value.trim();
            if (!nuevoTexto) {
                alert("⚠️ La descripción no puede estar vacía.");
                return;
            }

            // Actualizamos los datos
            apuntes[aIndex].items[iIndex].texto = nuevoTexto;

            if (esCuentas) {
                let cant = parseInt(document.getElementById('edit-item-cant').value);
                let valor = parseFloat(document.getElementById('edit-item-valor').value);
                
                apuntes[aIndex].items[iIndex].cantidad = cant > 0 ? cant : 1;
                apuntes[aIndex].items[iIndex].valor = valor >= 0 ? valor : 0;
            }

            // Guardamos y refrescamos
            localStorage.setItem('aldia_apuntes', JSON.stringify(apuntes));
            renderizarApuntes();
            modalEditarItemInstancia.hide();
        }
    }
}
// --- NAVEGACIÓN TIPO APP MÓVIL ---
function navegar(pantallaId) {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('vista-' + pantallaId).classList.add('activa');
    
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    let navBtn = document.getElementById('nav-' + pantallaId);
    if(navBtn) navBtn.classList.add('active');
    
    if(pantallaId === 'dashboard') renderizarDashboard();
    if(pantallaId === 'estadisticas') renderizarEstadisticas();
    if(pantallaId === 'calendario') renderizarCalendario();
        if(pantallaId === 'apuntes') renderizarApuntes();
    if(pantallaId === 'nuevo') renderizarFormularioRegistro();
    
    window.scrollTo(0, 0);
}

// ==========================================
// --- SISTEMA DE BACKUP Y RESTAURACIÓN ---
// ==========================================

let modalCargaBackupInstancia = null;
let accionAlCerrarModal = null;

function exportarDatos() {
    accionAlCerrarModal = null;
    let chkClientes = document.getElementById('chk-export-clientes');
    let chkPagos = document.getElementById('chk-export-pagos');
    let chkEgresos = document.getElementById('chk-export-egresos');
    let chkApuntes = document.getElementById('chk-export-apuntes');
    let chkHabitaciones = document.getElementById('chkBackupHabitaciones');
    let chkServicios = document.getElementById('chkBackupServicios');

    let incluirClientes = chkClientes ? chkClientes.checked : true;
    let incluirPagos = chkPagos ? chkPagos.checked : true;
    let incluirEgresos = chkEgresos ? chkEgresos.checked : true;
    let incluirApuntes = chkApuntes ? chkApuntes.checked : true;
    let incluirHabitaciones = chkHabitaciones ? chkHabitaciones.checked : true;
    let incluirServicios = chkServicios ? chkServicios.checked : true;

    if (!incluirClientes && !incluirPagos && !incluirEgresos && !incluirApuntes && !incluirHabitaciones && !incluirServicios) {
        alert("⚠️ Selecciona al menos una casilla para respaldar.");
        return;
    }

    // Preparar y mostrar el modal
    if (!modalCargaBackupInstancia) {
        const modalEl = document.getElementById('modalCargaBackup');
        if (modalEl) {
            modalCargaBackupInstancia = new bootstrap.Modal(modalEl);
        }
    }
    
    // Capturar elementos de la interfaz
    let barra = document.getElementById('barra-progreso-backup');
    let icono = document.getElementById('icono-backup');
    let titulo = document.getElementById('titulo-backup');
    let texto = document.getElementById('texto-backup');
    let btnCerrar = document.getElementById('btn-cerrar-backup');
    let btnCompartir = document.getElementById('btn-compartir-backup');

    // Estado visual inicial
    if (barra) {
        barra.style.width = '100%';
        barra.innerText = '100%';
        barra.classList.remove('progress-bar-animated'); 
    }
    if (icono) icono.className = 'fas fa-spinner fa-spin text-success mb-3';
    if (titulo) titulo.innerText = 'Generando respaldo...';
    if (texto) texto.innerText = 'Empaquetando datos y guardando en Descargas...';
    if (btnCerrar) btnCerrar.classList.add('d-none');
    if (btnCompartir) btnCompartir.classList.add('d-none');

    if (modalCargaBackupInstancia) {
        modalCargaBackupInstancia.show();
    }

    // Ejecución inmediata en la cadena de eventos del clic (sin setTimeout ni demoras que rompan el User Gesture)
    ejecutarDescargaReal(incluirClientes, incluirPagos, incluirEgresos, incluirApuntes, incluirHabitaciones, incluirServicios);
}

// Función para cerrar el modal cuando el usuario decida
function cerrarModalBackup() {
    if (modalCargaBackupInstancia) {
        modalCargaBackupInstancia.hide();
    }
    if (typeof accionAlCerrarModal === 'function') {
        let callback = accionAlCerrarModal;
        accionAlCerrarModal = null;
        callback();
    }
}

let ultimoBackupUri = null;
let ultimoBackupNombre = "";

async function ejecutarDescargaReal(incluirClientes = true, incluirPagos = true, incluirEgresos = true, incluirApuntes = true, incluirHabitaciones = true, incluirServicios = true) {
    let barra = document.getElementById('barra-progreso-backup');
    let icono = document.getElementById('icono-backup');
    let titulo = document.getElementById('titulo-backup');
    let texto = document.getElementById('texto-backup');
    let btnCerrar = document.getElementById('btn-cerrar-backup');
    let btnCompartir = document.getElementById('btn-compartir-backup');

    ultimoBackupUri = null;
    ultimoBackupNombre = "";

    // 1. Recopilación directa de datos de localStorage
    let datosRecopilados = {};

    if (incluirClientes) {
        datosRecopilados.clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    }
    if (incluirPagos) {
        datosRecopilados.pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    }
    if (incluirEgresos) {
        datosRecopilados.egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
    }
    if (incluirApuntes) {
        datosRecopilados.apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
    }
    if (incluirHabitaciones) {
        const habs = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
        datosRecopilados.aldia_habitaciones = habs;
        datosRecopilados.habitaciones = habs;
    }
    if (incluirServicios) {
        const servs = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
        datosRecopilados.aldia_servicios = servs;
        datosRecopilados.servicios = servs;
    }

    // 2. Creación del contenido del archivo y nombre con fecha legible
    const backupData = JSON.stringify(datosRecopilados, null, 2);
    const ahora = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fechaStr = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}_${pad(ahora.getHours())}${pad(ahora.getMinutes())}${pad(ahora.getSeconds())}`;
    const nombreArchivo = `Backup_ALDIA_${fechaStr}.json`;
    ultimoBackupNombre = nombreArchivo;

    // 3. Detección de entorno Capacitor Nativo (Android / iOS)
    const isCapacitorNative = Boolean(
        typeof window !== 'undefined' &&
        window.Capacitor &&
        (
            (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
            (typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web') ||
            Boolean(window.Capacitor.Plugins?.Filesystem) ||
            Boolean(window.Capacitor.Plugins?.Share)
        )
    );

    try {
        if (isCapacitorNative) {
            // === RUTA NATIVA EN ANDROID CON CAPACITOR: GUARDADO DIRECTO ===
            const Filesystem = window.Capacitor?.Plugins?.Filesystem;
            if (!Filesystem?.writeFile && typeof window.Capacitor?.nativePromise !== 'function') {
                throw new Error("Plugin Filesystem de Capacitor no está disponible.");
            }

            const escribirArchivo = async (path, directory) => {
                if (Filesystem?.writeFile) {
                    return await Filesystem.writeFile({
                        path,
                        data: backupData,
                        directory,
                        encoding: 'utf8',
                        recursive: true
                    });
                }
                return await window.Capacitor.nativePromise('Filesystem', 'writeFile', {
                    path,
                    data: backupData,
                    directory,
                    encoding: 'utf8',
                    recursive: true
                });
            };

            let writeResult = null;
            let carpetaDestino = "Descargas";

            // Prioridad 1: Guardar directamente en la carpeta Descargas (Download)
            try {
                writeResult = await escribirArchivo(`Download/${nombreArchivo}`, 'EXTERNAL_STORAGE');
                carpetaDestino = "Descargas (Download)";
            } catch (errDownload) {
                console.warn("Intento en Download/ (EXTERNAL_STORAGE) no disponible, intentando en Documentos:", errDownload);
                // Prioridad 2: Guardar directamente en la carpeta Documentos (Documents)
                try {
                    writeResult = await escribirArchivo(nombreArchivo, 'DOCUMENTS');
                    carpetaDestino = "Documentos";
                } catch (errDocs) {
                    console.warn("Intento en DOCUMENTS no disponible, guardando en CACHE:", errDocs);
                    // Prioridad 3: Guardar en CACHE
                    writeResult = await escribirArchivo(nombreArchivo, 'CACHE');
                    carpetaDestino = "Almacenamiento del Dispositivo";
                }
            }

            if (!writeResult || !writeResult.uri) {
                throw new Error("No se obtuvo confirmación del archivo guardado.");
            }

            ultimoBackupUri = writeResult.uri;

            // Éxito nativo directo
            if (icono) icono.className = 'fas fa-check-circle text-success mb-3';
            if (titulo) titulo.innerText = '¡Respaldo Guardado!';
            if (texto) {
                texto.innerHTML = `Guardado directamente en tu carpeta de <b>${carpetaDestino}</b>:<br><div class="badge bg-light text-dark border p-2 mt-2 font-monospace text-wrap">${nombreArchivo}</div>`;
            }

            // Habilitar opción de compartir opcionalmente
            if (btnCompartir) {
                btnCompartir.classList.remove('d-none');
            }

        } else {
            // === RUTA WEB / ESCRITORIO (FALLBACK PARA NAVEGADOR - DESCARGA DIRECTA) ===
            const blob = new Blob([backupData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombreArchivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1500);

            if (icono) icono.className = 'fas fa-check-circle text-success mb-3';
            if (titulo) titulo.innerText = '¡Respaldo Descargado!';
            if (texto) {
                texto.innerHTML = `El archivo se ha descargado directamente en tu carpeta de <b>Descargas</b>:<br><div class="badge bg-light text-dark border p-2 mt-2 font-monospace text-wrap">${nombreArchivo}</div>`;
            }
        }

    } catch (error) {
        const errorMsg = (error && error.message) ? error.message : String(error || '');
        console.error("Error al exportar datos:", error);
        if (icono) icono.className = 'fas fa-exclamation-triangle text-danger mb-3';
        if (titulo) titulo.innerText = 'Error al Generar Respaldo';
        if (texto) texto.innerText = 'Ocurrió un error al procesar el archivo: ' + errorMsg;
    } finally {
        if (barra) {
            barra.style.width = '100%';
            barra.innerText = '100%';
            barra.classList.remove('progress-bar-animated');
        }
        if (btnCerrar) {
            btnCerrar.classList.remove('d-none');
        }
    }
}

// Función para compartir el respaldo recién generado si el usuario lo desea
async function compartirUltimoBackup() {
    if (!ultimoBackupUri) {
        alert("⚠️ No hay un archivo de respaldo reciente para compartir.");
        return;
    }

    try {
        const Share = window.Capacitor?.Plugins?.Share;
        if (Share?.share) {
            await Share.share({
                title: 'Backup Al Día',
                text: `Copia de seguridad de Al Día (${ultimoBackupNombre}).`,
                dialogTitle: 'Compartir Copia de Seguridad',
                files: [ultimoBackupUri]
            });
        } else if (typeof window.Capacitor?.nativePromise === 'function') {
            await window.Capacitor.nativePromise('Share', 'share', {
                title: 'Backup Al Día',
                text: `Copia de seguridad de Al Día (${ultimoBackupNombre}).`,
                dialogTitle: 'Compartir Copia de Seguridad',
                files: [ultimoBackupUri]
            });
        } else {
            alert("⚠️ La función de compartir no está disponible en este dispositivo.");
        }
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err || '');
        if (!/cancel/i.test(msg) && err?.name !== 'AbortError') {
            console.error("Error al compartir backup:", err);
        }
    }
}

// Aliases para compatibilidad directa y llamadas programáticas
function descargarBackup() {
    return exportarDatos();
}

function generarRespaldo() {
    return exportarDatos();
}

window.exportarDatos = exportarDatos;
window.descargarBackup = descargarBackup;
window.generarRespaldo = generarRespaldo;
window.ejecutarDescargaReal = ejecutarDescargaReal;
window.compartirUltimoBackup = compartirUltimoBackup;

function procesarImportacion(e) {
    let archivo = e.target.files[0];
    if (!archivo) return;

    let reader = new FileReader();
    reader.onload = function(event) {
        try {
            let data = JSON.parse(event.target.result);
            if (confirm("⚠️ ¿Estás seguro de restaurar estos datos?\n\nSe combinarán con tu información actual. Te recomendamos haber descargado un backup preventivo primero.")) {
                iniciarRestauracionConProgreso(data);
            }
        } catch (err) {
            alert("❌ El archivo no es válido o está dañado.");
        }
        e.target.value = ""; // Limpiar input
    };
    reader.readAsText(archivo);
}

function iniciarRestauracionConProgreso(data) {
    if (!modalCargaBackupInstancia) {
        modalCargaBackupInstancia = new bootstrap.Modal(document.getElementById('modalCargaBackup'));
    }

    let barra = document.getElementById('barra-progreso-backup');
    let icono = document.getElementById('icono-backup');
    let titulo = document.getElementById('titulo-backup');
    let texto = document.getElementById('texto-backup');
    let btnCerrar = document.getElementById('btn-cerrar-backup');

    barra.style.width = '0%';
    barra.innerText = '0%';
    barra.classList.add('progress-bar-animated');
    icono.className = 'fas fa-spinner fa-spin text-primary mb-3';
    titulo.innerText = 'Restaurando tu información...';
    texto.innerText = 'Combinando clientes, recibos, egresos y apuntes de forma segura...';
    btnCerrar.classList.add('d-none');

    modalCargaBackupInstancia.show();

    // Guardar snapshot de seguridad antes de modificar nada
    guardarSnapshot();

    // Callback al presionar el botón Aceptar
    accionAlCerrarModal = () => {
        location.reload();
    };

    let progreso = 0;
    let intervalo = setInterval(() => {
        progreso += Math.floor(Math.random() * 15) + 10;

        if (progreso >= 100) {
            progreso = 100;
            clearInterval(intervalo);

            barra.style.width = '100%';
            barra.innerText = '100%';
            barra.classList.remove('progress-bar-animated');

            setTimeout(() => {
                try {
                    ejecutarRestauracion(data);
                    icono.className = 'fas fa-check-circle text-success mb-3';
                    titulo.innerText = '¡Restauración Completada!';
                    texto.innerText = 'Se han procesado tus datos exitosamente. Presiona Aceptar para aplicar los cambios.';
                    btnCerrar.classList.remove('d-none');
                } catch (err) {
                    icono.className = 'fas fa-exclamation-triangle text-danger mb-3';
                    titulo.innerText = 'Error al Restaurar';
                    texto.innerText = 'Ocurrió un inconveniente: ' + err.message;
                    accionAlCerrarModal = null;
                    btnCerrar.classList.remove('d-none');
                }
            }, 400);
        } else {
            barra.style.width = progreso + '%';
            barra.innerText = progreso + '%';
        }
    }, 180);
}

function ejecutarRestauracion(data) {
    localStorage.removeItem('aldia_clientes');
    localStorage.removeItem('aldia_pagos');
    localStorage.removeItem('aldia_egresos');

    let currentClientes = [];
    let currentPagos = [];
    let currentEgresos = [];
    let currentApuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];

    let mapeoNuevosIds = {}; // Para reconectar pagos si el ID del cliente cambia

    // 1. RESTAURAR CLIENTES
    if (data.clientes) {
        data.clientes.forEach(impCli => {
            currentClientes.push(impCli);
            mapeoNuevosIds[impCli.id] = impCli.id;
        });
    }

    // 2. RESTAURAR PAGOS (Reemplazo total sin fusionar con caché previo)
    if (data.pagos) {
        data.pagos.forEach(pagoImportado => {
            let idDestino = mapeoNuevosIds[pagoImportado.cliente_id] || pagoImportado.cliente_id;
            currentPagos.push({ ...pagoImportado, id: pagoImportado.id, cliente_id: idDestino });
        });
    }

    // 3. RESTAURAR EGRESOS (Reemplazo total sin fusionar con caché previo)
    if (data.egresos) {
        data.egresos.forEach(egresoImportado => {
            currentEgresos.push({ ...egresoImportado, id: egresoImportado.id });
        });
    }

    // 4. RESTAURAR APUNTES
    if (data.apuntes) {
        data.apuntes.forEach(aImp => {
            if (!currentApuntes.find(a => a.titulo === aImp.titulo)) {
                currentApuntes.push(aImp);
            } else {
                currentApuntes.push({ ...aImp, id: Date.now() + Math.floor(Math.random() * 10000), titulo: aImp.titulo + " (Copia)" });
            }
        });
    }

    // Guardar absolutamente todo en LocalStorage
    localStorage.setItem('aldia_clientes', JSON.stringify(currentClientes));
    localStorage.setItem('aldia_pagos', JSON.stringify(currentPagos));
    localStorage.setItem('aldia_egresos', JSON.stringify(currentEgresos));
    localStorage.setItem('aldia_apuntes', JSON.stringify(currentApuntes));

    // 5. RESTAURAR HABITACIONES (Fase 4.3)
    if (data.aldia_habitaciones) {
        localStorage.setItem('aldia_habitaciones', JSON.stringify(data.aldia_habitaciones));
    } else if (data.habitaciones) {
        localStorage.setItem('aldia_habitaciones', JSON.stringify(data.habitaciones));
    }

    // 6. RESTAURAR SERVICIOS Y CATEGORÍAS (Fase 4.3)
    if (data.aldia_servicios) {
        localStorage.setItem('aldia_servicios', JSON.stringify(data.aldia_servicios));
    } else if (data.servicios) {
        localStorage.setItem('aldia_servicios', JSON.stringify(data.servicios));
    }

    // Refrescar vistas del inventario y estado restaurado
    if (typeof renderizarGestorInventario === 'function') renderizarGestorInventario();
    if (typeof cargarCategoriasPrincipales === 'function') cargarCategoriasPrincipales();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
    if (typeof renderizarDashboard === 'function') renderizarDashboard();
    if (typeof renderizarEstadisticas === 'function') renderizarEstadisticas();

    return true;
}

function toggleMetodoPagoInicial() {
    let divOpciones = document.getElementById('opciones-pago-inicial');
    if(document.getElementById('chk-pago-inicial').checked) {
        divOpciones.classList.remove('d-none');
    } else {
        divOpciones.classList.add('d-none');
    }
}

let mesVisualizado = hoy.getMonth() + 1;
let añoVisualizado = hoy.getFullYear();

function cambiarMes(direccion) {
    if (direccion > 0) {
        let esMesActualOSuperior = (añoVisualizado > añoActual) || (añoVisualizado === añoActual && mesVisualizado >= mesActual);
        if (esMesActualOSuperior) return; // Bloquear avance a meses futuros
    }
    mesVisualizado += direccion;
    if (mesVisualizado > 12) { mesVisualizado = 1; añoVisualizado++; }
    if (mesVisualizado < 1) { mesVisualizado = 12; añoVisualizado--; }
    renderizarDashboard();
}

// --- MANEJO DE EGRESOS ---
function guardarNuevoEgreso(e) {
    e.preventDefault();
    let fechaInput = document.getElementById('egr-fecha').value;
    if (!fechaInput) return;
    
    let [anio, mes, dia] = fechaInput.split('-').map(Number);
    
    let nEgr = {
        id: Date.now(),
        fecha: fechaInput,
        dia: dia,
        mes: mes,
        año: anio,
        motivo: document.getElementById('egr-motivo').value.trim(),
        monto: parseFloat(document.getElementById('egr-monto').value)
    };
    
    let egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
    egresos.push(nEgr);
    localStorage.setItem('aldia_egresos', JSON.stringify(egresos));
    
    document.getElementById('form-nuevo-egreso').reset();
    navegar('dashboard'); // Volvemos al inicio para ver el cambio
}

function eliminarEgreso(id) {
    if(confirm("¿Seguro que deseas eliminar este gasto? El dinero regresará a tu saldo neto.")) {
        guardarSnapshot();
        let egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
        let index = egresos.findIndex(e => e.id === id);
        let motivo = index !== -1 ? egresos[index].motivo : "Gasto";
        egresos = egresos.filter(e => e.id !== id);
        localStorage.setItem('aldia_egresos', JSON.stringify(egresos));
        mostrarToastDeshacer(`Egreso "${motivo}" eliminado.`);
        renderizarDashboard();
        renderizarEstadisticas();
    }
}

// Muestra u oculta todo el bloque de garantía
function toggleOpcionesGarantia() {
    let divOpciones = document.getElementById('opciones-garantia');
    let tieneGarantia = document.getElementById('chk-tiene-garantia').checked;
    
    if (tieneGarantia) {
        divOpciones.classList.remove('d-none');
    } else {
        divOpciones.classList.add('d-none');
        
        // Limpieza: Si apagas el interruptor principal, reseteamos el de "Garantía ya pagada"
        let chkPagada = document.getElementById('chk-garantia-pagada');
        if(chkPagada) {
            chkPagada.checked = false;
            toggleFechaGarantia(); // Forzamos a que reaparezca el campo de fecha por detrás
        }
    }
}

// Muestra u oculta exclusivamente el campo de Fecha de Garantía
function toggleFechaGarantia() {
    let divFecha = document.getElementById('div-fecha-garantia');
    let pagada = document.getElementById('chk-garantia-pagada').checked;
    
    if (pagada) {
        divFecha.classList.add('d-none'); // Lo oculta
    } else {
        divFecha.classList.remove('d-none'); // Lo muestra
    }
}

// --- PROCESAR EL RETIRO (MUDANZA) A PRUEBA DE BALAS ---
function procesarMudanza() {
    let clienteId = parseInt(document.getElementById('baja-cliente-id').value);
    guardarSnapshot(); // 📸 ¡FOTO TOMADA!
    
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
    
    let cIndex = clientes.findIndex(c => c.id === clienteId);
    if (cIndex === -1) return;
    
    let cliente = clientes[cIndex];
    let esStreaming = cliente.tipo_servicio === 'streaming';
    
    // 1. Desactivar al cliente (Aplica para ambos)
    clientes[cIndex].activo = false;

    // 2. Lógica solo para CUARTOS (Prorrateo y Garantía)
    if (!esStreaming) {
        let montoAlquilerFinal = parseFloat(document.getElementById('baja-monto-cobrar').value) || 0;
        let pagoIndex = pagos.findIndex(p => p.cliente_id === clienteId && p.mes === mesActual && p.año === añoActual && !p.es_garantia);
        
        if (pagoIndex !== -1) {
            pagos[pagoIndex].monto = montoAlquilerFinal;
            pagos[pagoIndex].pagado = true; 
            if (!pagos[pagoIndex].metodo) pagos[pagoIndex].metodo = "Liquidación Final";
            if (!pagos[pagoIndex].id_recibo) pagos[pagoIndex].id_recibo = "REC-" + Date.now().toString().slice(-6);
            if (!pagos[pagoIndex].fecha_emision) pagos[pagoIndex].fecha_emision = formatearFechaHora(Date.now());
        } else {
            let idBaja = Date.now();
            pagos.push({
                id: idBaja,
                fecha_pago_real: Date.now(),
                cliente_id: cliente.id,
                mes: mesActual,
                año: añoActual,
                monto: montoAlquilerFinal,
                pagado: true,
                metodo: "Liquidación Final",
                historico: `${cliente.nombre} ${cliente.apellido || ''}`.trim(),
                id_recibo: "REC-" + idBaja.toString().slice(-6),
                fecha_emision: formatearFechaHora(idBaja)
            });
        }

        let montoGar = parseFloat(cliente.garantia_monto) || 0;
        let estaPagada = cliente.garantia_pagada === true || String(cliente.garantia_pagada) === "true";

        if (estaPagada && montoGar > 0) {
            let inputDescuento = document.getElementById('baja-garantia-descuento');
            let descuento = inputDescuento ? (parseFloat(inputDescuento.value) || 0) : 0;
            let devolver = montoGar - descuento;
            if (devolver < 0) devolver = 0;

            if (devolver > 0) {
                let fechaHoy = new Date();
                egresos.push({
                    id: Date.now(),
                    fecha: `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth()+1).padStart(2,'0')}-${String(fechaHoy.getDate()).padStart(2,'0')}`,
                    dia: fechaHoy.getDate(),
                    mes: fechaHoy.getMonth() + 1,
                    año: fechaHoy.getFullYear(),
                    motivo: `Devolución de Garantía - ${cliente.nombre}`,
                    monto: devolver
                });
            }
        }
    }

    // 3. Borrar recibos futuros pendientes (Aplica para ambos)
    pagos = pagos.filter(p => !(p.cliente_id === clienteId && p.pagado === false && (p.año > añoActual || (p.año === añoActual && p.mes > mesActual))));

    // Guardar
    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
    localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
    localStorage.setItem('aldia_egresos', JSON.stringify(egresos));

    modalBajaInstancia.hide();
    
    let mensajeExito = esStreaming ? `Suscripción de ${cliente.nombre} cancelada.` : `Mudanza de ${cliente.nombre} registrada.`;
    mostrarToastDeshacer(mensajeExito);
    
    renderizarDashboard();
    renderizarEstadisticas();
}

// --- PROCESAR BORRADO POR ERROR (HARD DELETE) ---
function procesarEliminacionRastro() {
    let clienteId = parseInt(document.getElementById('baja-cliente-id').value);
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente y todo su historial de registros? Esta acción no se puede deshacer.')) return;
    
    guardarSnapshot(); // 📸 ¡FOTO TOMADA!
    
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    
    clientes = clientes.filter(c => c.id !== clienteId);
    pagos = pagos.filter(p => p.cliente_id !== clienteId);
    
    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
    localStorage.setItem('aldia_pagos', JSON.stringify(pagos));

    modalBajaInstancia.hide();
    
    // Mostramos el mensaje flotante
    mostrarToastDeshacer("Cliente y su historial eliminados.");
    
    renderizarDashboard();
    renderizarEstadisticas();
}

// ==========================================
// --- SISTEMA DE DESHACER (MÁQUINA DEL TIEMPO) ---
// ==========================================
let timerToast;

function guardarSnapshot() {
    let snapshot = {
        clientes: localStorage.getItem('aldia_clientes'),
        pagos: localStorage.getItem('aldia_pagos'),
        egresos: localStorage.getItem('aldia_egresos'),
        apuntes: localStorage.getItem('aldia_apuntes'),
        habitaciones: localStorage.getItem('aldia_habitaciones'),
        servicios: localStorage.getItem('aldia_servicios')
    };
    localStorage.setItem('aldia_undo', JSON.stringify(snapshot));
}

function mostrarToastDeshacer(mensaje) {
    let toast = document.getElementById('toast-deshacer');
    document.getElementById('toast-msg').innerText = mensaje;
    toast.style.display = 'block';
    
    clearTimeout(timerToast);
    // Se oculta después de 10 segundos, PERO ya no borra la memoria
    timerToast = setTimeout(() => {
        cerrarToast();
    }, 10000);
}

function cerrarToast() {
    document.getElementById('toast-deshacer').style.display = 'none';
    // ¡OJO! Hemos quitado la línea que borraba el 'aldia_undo' 
    // para que el botón de Gestión pueda usarlo después.
}

// Función que usa el botón del aviso flotante
function ejecutarDeshacer() {
    restaurarDesdeSnapshot("✅ Uff... ¡Salvado! Todo ha vuelto a como estaba antes del clic.");
}

// Función que usa el botón de emergencia en la pestaña Gestión
function ejecutarDeshacerManual() {
    let snapshotData = localStorage.getItem('aldia_undo');
    if (!snapshotData) {
        alert("⚠️ No hay ningún borrado reciente guardado en la memoria para deshacer.");
        return;
    }
    
    if(confirm("¿Seguro que deseas deshacer el último borrado?\n\nEsto restaurará tu base de datos a como estaba justo antes de tu última eliminación.")) {
        restaurarDesdeSnapshot("✅ ¡Restauración de emergencia completada!");
    }
}

// El motor central que hace el trabajo pesado
function restaurarDesdeSnapshot(mensajeExito) {
    let snapshotData = localStorage.getItem('aldia_undo');
    if (snapshotData) {
        let snapshot = JSON.parse(snapshotData);
        
        if(snapshot.clientes !== undefined && snapshot.clientes !== null) localStorage.setItem('aldia_clientes', snapshot.clientes);
        if(snapshot.pagos !== undefined && snapshot.pagos !== null) localStorage.setItem('aldia_pagos', snapshot.pagos);
        if(snapshot.egresos !== undefined && snapshot.egresos !== null) localStorage.setItem('aldia_egresos', snapshot.egresos);
        if(snapshot.apuntes !== undefined && snapshot.apuntes !== null) localStorage.setItem('aldia_apuntes', snapshot.apuntes);
        if(snapshot.habitaciones !== undefined && snapshot.habitaciones !== null) localStorage.setItem('aldia_habitaciones', snapshot.habitaciones);
        if(snapshot.servicios !== undefined && snapshot.servicios !== null) localStorage.setItem('aldia_servicios', snapshot.servicios);
        
        // Una vez que lo usamos exitosamente, ahora sí limpiamos la memoria
        localStorage.removeItem('aldia_undo');
        cerrarToast();
        
        alert(mensajeExito);
        
        renderizarDashboard();
        renderizarEstadisticas();
        if (typeof renderizarCalendario === 'function') renderizarCalendario();
        if (typeof renderizarApuntes === 'function') renderizarApuntes();
        if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
        // Si estábamos en Gestión, volvemos a Inicio para que el usuario vea que volvió
        navegar('dashboard');
    }
}

// --- NUEVA FUNCIÓN: CAMBIAR TIPO DE SERVICIO ---
function toggleTipoServicio() {
    let esStreaming = document.getElementById('tipo-streaming').checked;
    let lblReferencia = document.getElementById('lbl-referencia');
    let bloqueGarantia = document.getElementById('bloque-garantia');

    if (esStreaming) {
        // Modo Streaming: Cambiar texto y ocultar garantía
        lblReferencia.innerText = "Perfil / Pin / Correo (Ej: Netflix Perfil 1)";
        bloqueGarantia.classList.add('d-none');
        
        // Si por accidente habían encendido el switch de garantía antes, lo apagamos por seguridad
        let chkTieneGar = document.getElementById('chk-tiene-garantia');
        if(chkTieneGar && chkTieneGar.checked) {
            chkTieneGar.checked = false;
            toggleOpcionesGarantia();
        }
    } else {
        // Modo Cuarto: Restaurar texto y mostrar garantía
        lblReferencia.innerText = "Referencia (Ej: Cuarto 301)";
        bloqueGarantia.classList.remove('d-none');
    }
}

// --- NUEVA FUNCIÓN: SUMAR DÍAS A STREAMING ---
function sumarDiasStreaming(clienteId, nombre) {
    let dias = prompt(`⏳ ¿Cuántos días extra deseas sumarle al servicio de ${nombre}?`);
    
    // Si cancela o pone 0, no hacemos nada
    if (!dias || isNaN(dias) || parseInt(dias) <= 0) return;
    
    dias = parseInt(dias);
    
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let index = clientes.findIndex(c => c.id === clienteId);
    
    if (index !== -1) {
        let cliente = clientes[index];
        
        // Calculamos el nuevo día de corte inteligentemente
        let fechaSimulada = new Date(añoActual, mesActual - 1, cliente.dia);
        fechaSimulada.setDate(fechaSimulada.getDate() + dias);
        
        let nuevoDia = fechaSimulada.getDate();
        cliente.dia = nuevoDia; // Actualizamos el día de cobro permanentemente
        
        // Tomamos una "foto" de seguridad por si nos equivocamos
        guardarSnapshot(); 
        
        localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
        
        mostrarToastDeshacer(`✅ Se sumaron ${dias} días. Nuevo corte de ${nombre}: los días ${nuevoDia}.`);
        renderizarDashboard();
    }
}

// ==========================================
// --- EDICIÓN DE CLIENTES ---
// ==========================================
let modalEditarInstancia = null;

function abrirModalEditarCliente(clienteId) {
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let cliente = clientes.find(c => c.id === clienteId);
    
    if (cliente) {
        // Llenar los datos actuales del cliente en el formulario
        document.getElementById('edit-cli-id').value = cliente.id;
        document.getElementById('edit-cli-nombre').value = cliente.nombre;
        document.getElementById('edit-cli-apellido').value = cliente.apellido || '';
        const inputEditTel = document.getElementById('edit-cli-telefono');
        if (inputEditTel) inputEditTel.value = cliente.telefono || '';
        document.getElementById('edit-cli-monto').value = cliente.monto;
        document.getElementById('edit-cli-dia').value = cliente.dia;
        const inputEditRef = document.getElementById('edit-cli-ref');
        if (inputEditRef) {
            inputEditRef.value = cliente.ref || '';
            inputEditRef.readOnly = true;
            inputEditRef.disabled = true;
            inputEditRef.style.backgroundColor = '#e9ecef';
            inputEditRef.style.cursor = 'not-allowed';
            inputEditRef.style.border = '1px solid #ced4da';
        }
        
        if (!modalEditarInstancia) {
            modalEditarInstancia = new bootstrap.Modal(document.getElementById('modalEditarCliente'));
        }
        modalEditarInstancia.show();
    }
}

function guardarEdicionCliente(e) {
    e.preventDefault();
    
    let id = parseInt(document.getElementById('edit-cli-id').value);
    let nuevoNombre = document.getElementById('edit-cli-nombre').value.trim();
    let nuevoApellido = document.getElementById('edit-cli-apellido').value.trim();
    const inputEditTel = document.getElementById('edit-cli-telefono');
    let nuevoTelefono = inputEditTel ? inputEditTel.value.trim() : '';
    let nuevoMonto = parseFloat(document.getElementById('edit-cli-monto').value);
    let nuevoDia = parseInt(document.getElementById('edit-cli-dia').value);
    const inputEditRef = document.getElementById('edit-cli-ref');
    let nuevaRef = inputEditRef ? inputEditRef.value.trim() : '';
    
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    
    let cIndex = clientes.findIndex(c => c.id === id);
    
    if (cIndex !== -1) {
        // 1. Actualizamos el perfil base del cliente (manteniendo la referencia protegida)
        clientes[cIndex].nombre = nuevoNombre;
        clientes[cIndex].apellido = nuevoApellido;
        clientes[cIndex].telefono = nuevoTelefono;
        clientes[cIndex].monto = nuevoMonto;
        clientes[cIndex].dia = nuevoDia;
        clientes[cIndex].ref = clientes[cIndex].ref || nuevaRef;
        
        let nombreCompleto = `${nuevoNombre} ${nuevoApellido}`.trim();
        
        // 2. Lógica Inteligente para los Pagos (No tocar el pasado)
        pagos = pagos.map(p => {
            if (p.cliente_id === id) {
                // Si el recibo está pendiente, se actualiza el monto y el nombre
                if (p.pagado === false) {
                    return { ...p, monto: nuevoMonto, historico: nombreCompleto };
                } 
                // Si ya fue pagado, conservamos su monto intacto para no dañar las cuentas, 
                // pero actualizamos el nombre por si hubo correcciones ortográficas.
                else {
                    return { ...p, historico: nombreCompleto };
                }
            }
            return p;
        });
        
        // 3. Guardar en memoria y refrescar pantallas
        localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
        localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
        
        modalEditarInstancia.hide();
        renderizarDashboard();
        if (typeof renderizarCalendario === "function") renderizarCalendario();
        if (typeof renderizarEstadisticas === "function") renderizarEstadisticas();
    }
}

// --- FUNCIONES PARA ELIMINACIÓN DIRECTA DESDE HISTORIAL (PAPELERAS) ---
window.eliminarPagoHistorial = function(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este registro? Esta acción actualizará tu saldo neto.')) {
        if (typeof guardarSnapshot === 'function') guardarSnapshot();
        let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
        pagos = pagos.filter(p => Number(p.id) !== Number(id));
        localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
        location.reload();
    }
};

window.eliminarEgresoHistorial = function(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este registro? Esta acción actualizará tu saldo neto.')) {
        if (typeof guardarSnapshot === 'function') guardarSnapshot();
        let egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
        egresos = egresos.filter(e => Number(e.id) !== Number(id));
        localStorage.setItem('aldia_egresos', JSON.stringify(egresos));
        location.reload();
    }
};

// ==========================================
// --- MÓDULO DE REGISTRO DINÁMICO (FASE 2) ---
// ==========================================

// Plantilla para registro de Cliente y cobros
const templateCliente = `
<form id="form-nuevo-cliente">
    <!-- Bloque 1 (Actividad) -->
    <div class="mb-4">
        <label class="form-label text-muted small fw-bold mb-2" for="selectCategoriaPrincipal">Actividad o servicio</label>
        <select id="selectCategoriaPrincipal" class="form-select">
            <option value="alquiler" selected>Alquiler de habitación</option>
            <option value="streaming">Streaming o suscripción</option>
            <option value="academia">Inscripción de Alumnos</option>
            <option value="otro">Otro servicio</option>
            <option value="nuevo_global">+ Crear nueva categoría...</option>
        </select>
        <input type="text" class="form-control d-none mt-2" id="inputNuevaCategoriaGlobal" placeholder="Ej. Cochera, Lavandería">
    </div>

    <!-- Bloque 2 (Persona) -->
    <div class="mb-4">
        <label class="form-label text-muted small fw-bold mb-2">Datos de la persona</label>
        <div class="row g-2 mb-2">
            <div class="col-6">
                <label class="form-label text-muted small fw-bold" for="cli-nombre">Nombre</label>
                <input type="text" class="form-control" id="cli-nombre" placeholder="Nombre" required>
            </div>
            <div class="col-6">
                <label class="form-label text-muted small fw-bold" for="cli-apellido">Apellido</label>
                <input type="text" class="form-control" id="cli-apellido" placeholder="Apellido">
            </div>
        </div>
        <div>
            <label class="form-label text-muted small fw-bold" for="cli-telefono"><i class="fab fa-whatsapp text-success me-1"></i> WhatsApp / Teléfono (Opcional)</label>
            <input type="tel" class="form-control" id="cli-telefono" placeholder="Ej: 987654321">
        </div>
    </div>

    <!-- Bloque 3 (Inventario Dinámico) -->
    <div class="mb-4">
        <label class="form-label text-muted small fw-bold mb-2" id="lbl-select-inventario" for="selectInventario">Habitación</label>
        <select class="form-select" id="selectInventario">
            <option value="" selected>Seleccionar...</option>
            <option value="crear_nuevo">+ Crear nuevo...</option>
            <option value="manual">Ingresar manualmente</option>
        </select>
        
        <!-- Contenedor para Nuevo Ítem (oculto por defecto) -->
        <div id="contenedorNuevoItem" class="d-none mt-2">
            <input type="text" class="form-control" id="inputNombreNuevoItem" placeholder="Ej. 305 o Nombre del servicio">
        </div>
    </div>

    <!-- Bloque 4 (Configuración) -->
    <div class="mb-4">
        <label class="form-label text-muted small fw-bold mb-2">Configuración de cobro</label>
        
        <!-- Fila 1: Importe (S/) y Frecuencia -->
        <div class="row g-2 mb-3">
            <div class="col-6">
                <label class="form-label text-muted small fw-bold" for="cli-monto">Importe (S/)</label>
                <div class="input-group">
                    <span class="input-group-text bg-light fw-bold text-muted border-end-0">S/</span>
                    <input type="number" step="0.01" min="0" class="form-control border-start-0" id="cli-monto" placeholder="0.00" required>
                </div>
            </div>
            <div class="col-6">
                <label class="form-label text-muted small fw-bold" for="cli-frecuencia">Frecuencia</label>
                <select class="form-select" id="cli-frecuencia">
                    <option value="mensual" selected>Mensual</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="semanal">Semanal</option>
                    <option value="diario">Diario</option>
                </select>
            </div>
        </div>

        <!-- Fila 2 (NUEVA): Duración de la estadía (oculto por defecto) -->
        <div id="contenedor-duracion-estadia" class="d-none mb-3">
            <label class="form-label text-muted small fw-bold" id="lbl-duracion-estadia" for="inputDuracionEstadia">Cantidad de días</label>
            <input type="number" class="form-control" id="inputDuracionEstadia" min="1" max="6" placeholder="Ej. 3">
        </div>

        <!-- Fila 3: Fecha del primer cobro -->
        <div>
            <label class="form-label text-muted small fw-bold" for="cli-fecha-inicio">Fecha del primer cobro</label>
            <input type="date" class="form-control" id="cli-fecha-inicio" required>
        </div>
    </div>

    <!-- Bloque 5 (Pagos Inferiores) -->
    <div class="mb-4">
        <!-- Checkbox: Registrar pago inicial ahora -->
        <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="chk-pago-inicial">
            <label class="form-check-label fw-bold text-dark small" for="chk-pago-inicial">
                Registrar pago inicial ahora
            </label>
        </div>

        <!-- Opciones de pago inicial desplegables (Fase 2.6) -->
        <div id="opciones-pago-inicial" class="d-none mb-3 p-3 border rounded-3 bg-light">
            <!-- 3 Modalidades de Pago dinámicas -->
            <div class="mb-3" id="contenedorModalidadesPago">
                <label class="form-label small fw-bold text-muted mb-2">Modalidad de pago inicial:</label>
                <div class="d-flex flex-column gap-2">
                    <div class="form-check p-2 ps-4 border rounded-2 bg-white">
                        <input class="form-check-input" type="radio" name="modalidadPago" id="radioOpcion1" value="opcion1" checked>
                        <label class="form-check-label small fw-bold text-dark w-100 ps-1" id="lblRadioOpcion1" for="radioOpcion1">
                            Pago del primer mes
                        </label>
                    </div>
                    <div class="form-check p-2 ps-4 border rounded-2 bg-white" id="contenedorRadioOpcion2">
                        <input class="form-check-input" type="radio" name="modalidadPago" id="radioOpcion2" value="opcion2">
                        <label class="form-check-label small fw-bold text-dark w-100 ps-1" id="lblRadioOpcion2" for="radioOpcion2">
                            Pago incompleto (Genera deuda)
                        </label>
                    </div>
                    <div class="form-check p-2 ps-4 border rounded-2 bg-white" id="contenedorRadioOpcion3">
                        <input class="form-check-input" type="radio" name="modalidadPago" id="radioOpcion3" value="opcion3">
                        <label class="form-check-label small fw-bold text-dark w-100 ps-1" id="lblRadioOpcion3" for="radioOpcion3">
                            Meses por adelantado
                        </label>
                    </div>
                </div>
            </div>

            <!-- Contenedor Tiempo / Periodos (divParcialTiempo) -->
            <div id="divParcialTiempo" class="d-none mb-3 p-3 bg-white border rounded-3">
                <label class="form-label small fw-bold text-muted mb-1" id="labelCantidadPagada" for="inputPeriodosPagados">Días pagados</label>
                <input type="number" class="form-control form-control-sm mb-2" id="inputPeriodosPagados" min="2" value="2">
                <div id="textoTotalCobrar" class="d-none fw-bold text-primary small">Total a cobrar: S/ 0.00</div>
            </div>

            <!-- Contenedor Dinero / Deuda (divAdelantoDinero) -->
            <div id="divAdelantoDinero" class="d-none mb-3 p-3 bg-white border rounded-3">
                <label class="form-label small fw-bold text-muted mb-1" id="labelMontoDinero" for="inputMontoAdelanto">Monto pagado</label>
                <div class="input-group input-group-sm mb-2">
                    <span class="input-group-text bg-light fw-bold text-muted border-end-0">S/</span>
                    <input type="number" step="0.01" min="0" class="form-control border-start-0" id="inputMontoAdelanto" placeholder="0.00">
                </div>
                <div id="textoDeudaRestante" class="fw-bold text-danger small mb-2">Deuda restante: S/ 0.00</div>
                <div>
                    <label class="form-label text-muted small fw-bold mb-1" id="labelFechaCobroDeuda" for="inputFechaCobroDeuda">Fecha de cobro de deuda</label>
                    <input type="date" class="form-control form-control-sm" id="inputFechaCobroDeuda">
                </div>
            </div>
        </div>

        <!-- Contenedor para Depósito de Garantía (Opcional) - Exclusivo para Alquiler -->
        <div class="border rounded-3 p-3 bg-light" id="bloque-garantia">
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="chk-tiene-garantia">
                <label class="form-check-label fw-bold text-dark small" for="chk-tiene-garantia">
                    Incluir depósito de garantía (Opcional)
                </label>
            </div>
            
            <div id="opciones-garantia" class="d-none mt-3 pt-3 border-top">
                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted" for="cli-garantia-monto">Monto (S/)</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-white fw-bold">S/</span>
                        <input type="number" step="0.01" class="form-control" id="cli-garantia-monto" placeholder="0.00">
                    </div>
                </div>
                
                <label class="form-label small fw-bold text-muted mb-2">Estado:</label>
                <div class="d-flex gap-4">
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="estado_garantia" id="garantia-pagada-ahora" value="pagada" checked>
                        <label class="form-check-label small fw-bold text-dark" for="garantia-pagada-ahora">
                            Pagada ahora
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="estado_garantia" id="garantia-por-cobrar" value="por_cobrar">
                        <label class="form-check-label small fw-bold text-dark" for="garantia-por-cobrar">
                            Por cobrar
                        </label>
                    </div>
                </div>

                <div id="div-fecha-garantia" class="d-none mt-3">
                    <label class="form-label text-muted small fw-bold" for="cli-garantia-fecha">¿Cuándo cobrará la garantía?</label>
                    <input type="date" class="form-control form-control-sm" id="cli-garantia-fecha">
                </div>
            </div>
        </div>
    </div>
</form>
`;

// Plantilla para registro de Nuevo egreso
const templateEgreso = `
<form id="form-nuevo-egreso">
    <div class="mb-3">
        <label class="form-label text-muted small fw-bold">Concepto</label>
        <input type="text" class="form-control" id="egr-motivo" placeholder="Ej: Pago de luz, compras, materiales..." required>
    </div>
    <div class="mb-3">
        <label class="form-label text-muted small fw-bold">Importe (S/)</label>
        <div class="input-group">
            <span class="input-group-text bg-danger text-white border-danger fw-bold">S/</span>
            <input type="number" step="0.01" min="0.1" class="form-control border-danger" id="egr-monto" placeholder="0.00" required>
        </div>
    </div>
    <div class="mb-3">
        <label class="form-label text-muted small fw-bold">Fecha</label>
        <input type="date" class="form-control" id="egr-fecha" required>
    </div>
    <div class="mb-4">
        <label class="form-label text-muted small fw-bold">Categoría</label>
        <select class="form-select" id="egr-categoria" required>
            <option value="Servicios básicos">Servicios básicos</option>
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Compras">Compras</option>
            <option value="Otros">Otros</option>
        </select>
    </div>
</form>
`;

// Controlador de Vista Dinámico
function renderizarFormularioRegistro() {
    const contenedor = document.getElementById('contenedorDinamicoRegistro');
    if (!contenedor) return;

    const radioCliente = document.getElementById('reg-raiz-cliente');
    const esCliente = radioCliente ? radioCliente.checked : true;

    if (esCliente) {
        contenedor.innerHTML = templateCliente;
        const formCliente = document.getElementById('form-nuevo-cliente');
        if (formCliente) {
            formCliente.addEventListener('submit', guardarNuevoCliente);
        }

        // Inicializar categorías y listener para selectCategoriaPrincipal (Fase 3.6)
        if (typeof cargarCategoriasPrincipales === 'function') {
            cargarCategoriasPrincipales();
        }
        const selectCategoria = document.getElementById('selectCategoriaPrincipal');
        if (selectCategoria) {
            selectCategoria.addEventListener('change', actualizarConfiguracionServicio);
        }
        const radiosActividad = document.querySelectorAll('input[name="tipo_actividad_servicio"]');
        radiosActividad.forEach(r => {
            r.addEventListener('change', actualizarConfiguracionServicio);
        });

        // Listener dinámico para inventario (+ Crear nuevo...)
        const selectInventario = document.getElementById('selectInventario');
        if (selectInventario) {
            selectInventario.addEventListener('change', manejarCambioInventario);
        }

        // Listener para frecuencia (regla de días para alquiler diario y límites)
        const selectFrecuencia = document.getElementById('cli-frecuencia');
        if (selectFrecuencia) {
            selectFrecuencia.addEventListener('change', manejarCambioFrecuencia);
        }

        // Listener para Duración de Estadía (validación cruzada de límites y fecha límite)
        const inputEstadia = document.getElementById('inputDuracionEstadia');
        if (inputEstadia) {
            const manejarCambioEstadia = () => {
                actualizarLimitePago();
                actualizarLimitesFechas();
                calcularDeudaAdelanto();
            };
            inputEstadia.addEventListener('input', manejarCambioEstadia);
            inputEstadia.addEventListener('change', manejarCambioEstadia);
        }

        // Listener para Fecha del primer cobro (actualiza min/max en calendarios de deuda y garantía)
        const fechaInicio = document.getElementById('cli-fecha-inicio');
        if (fechaInicio) {
            fechaInicio.addEventListener('change', actualizarLimitesFechas);
            fechaInicio.addEventListener('input', actualizarLimitesFechas);
        }

        // Listener para las 3 opciones de pago inicial (Fase 2.6)
        const radiosModalidad = document.querySelectorAll('input[name="modalidadPago"]');
        radiosModalidad.forEach(r => {
            r.addEventListener('change', manejarCambioModalidadPago);
        });

        // Listener para cálculo en tiempo real de deuda y totales (Blindaje de adelantos)
        const inputAdelanto = document.getElementById('inputMontoAdelanto');
        if (inputAdelanto) {
            inputAdelanto.addEventListener('input', calcularDeudaAdelanto);
            inputAdelanto.addEventListener('change', calcularDeudaAdelanto);
        }
        const inputMonto = document.getElementById('cli-monto');
        if (inputMonto) {
            inputMonto.addEventListener('input', () => {
                calcularDeudaAdelanto();
                calcularTotalAdelantado();
            });
        }

        // Listener para periodos pagados / meses adelantados
        const inputPeriodos = document.getElementById('inputPeriodosPagados');
        if (inputPeriodos) {
            const validarPeriodos = () => {
                const selectFreq = document.getElementById('cli-frecuencia');
                const radioSel = document.querySelector('input[name="modalidadPago"]:checked');
                const f = selectFreq ? selectFreq.value : 'mensual';
                const mod = radioSel ? radioSel.value : 'opcion1';

                if (f === 'mensual' && mod === 'opcion3') {
                    if (inputPeriodos.value && parseInt(inputPeriodos.value) < 2) {
                        inputPeriodos.value = "2";
                    }
                } else if (f === 'diario' || f === 'semanal') {
                    actualizarLimitePago();
                }
                calcularTotalAdelantado();
            };
            inputPeriodos.addEventListener('input', validarPeriodos);
            inputPeriodos.addEventListener('change', validarPeriodos);
        }

        // Listeners para calendarios (Deuda y Garantía) para blanquear si está fuera de [min, max]
        const inputFechaDeuda = document.getElementById('inputFechaCobroDeuda');
        const inputFechaGarantia = document.getElementById('cli-garantia-fecha');
        const validarLimitesFecha = (input) => {
            if (!input || !input.value) return;
            if ((input.min && input.value < input.min) || (input.max && input.value > input.max)) {
                input.value = '';
            }
        };

        if (inputFechaDeuda) {
            inputFechaDeuda.addEventListener('change', () => validarLimitesFecha(inputFechaDeuda));
            inputFechaDeuda.addEventListener('blur', () => validarLimitesFecha(inputFechaDeuda));
        }
        if (inputFechaGarantia) {
            inputFechaGarantia.addEventListener('change', () => validarLimitesFecha(inputFechaGarantia));
            inputFechaGarantia.addEventListener('blur', () => validarLimitesFecha(inputFechaGarantia));
        }

        // Listener para el switch de garantía
        const chkGarantia = document.getElementById('chk-tiene-garantia');
        if (chkGarantia) {
            chkGarantia.addEventListener('change', () => {
                const opcGar = document.getElementById('opciones-garantia');
                if (opcGar) opcGar.classList.toggle('d-none', !chkGarantia.checked);
            });
        }

        // Listener para los radios de estado de garantía
        const radiosEstadoGar = document.querySelectorAll('input[name="estado_garantia"]');
        radiosEstadoGar.forEach(rg => {
            rg.addEventListener('change', () => {
                const divFecha = document.getElementById('div-fecha-garantia');
                const porCobrar = document.getElementById('garantia-por-cobrar');
                if (divFecha && porCobrar) {
                    divFecha.classList.toggle('d-none', !porCobrar.checked);
                }
            });
        });

        // Listener para checkbox de pago inicial
        const chkPagoIni = document.getElementById('chk-pago-inicial');
        if (chkPagoIni) {
            chkPagoIni.addEventListener('change', () => {
                const opcPago = document.getElementById('opciones-pago-inicial');
                if (opcPago) {
                    opcPago.classList.toggle('d-none', !chkPagoIni.checked);
                    if (chkPagoIni.checked) {
                        manejarCambioModalidadPago();
                    }
                }
            });
        }

        // Asignar fecha de hoy por defecto al campo fecha de inicio
        if (fechaInicio && !fechaInicio.value) {
            const hoyObj = new Date();
            const yyyy = hoyObj.getFullYear();
            const mm = String(hoyObj.getMonth() + 1).padStart(2, '0');
            const dd = String(hoyObj.getDate()).padStart(2, '0');
            fechaInicio.value = `${yyyy}-${mm}-${dd}`;
        }

        // Ejecutar estado inicial
        actualizarConfiguracionServicio();
        manejarCambioFrecuencia();
        actualizarLimitesFechas();
    } else {
        contenedor.innerHTML = templateEgreso;
        const formEgreso = document.getElementById('form-nuevo-egreso');
        if (formEgreso) {
            formEgreso.addEventListener('submit', guardarNuevoEgreso);
        }
        // Asignar fecha de hoy por defecto al campo fecha de egreso
        const fechaEgreso = document.getElementById('egr-fecha');
        if (fechaEgreso && !fechaEgreso.value) {
            const hoyObj = new Date();
            const yyyy = hoyObj.getFullYear();
            const mm = String(hoyObj.getMonth() + 1).padStart(2, '0');
            const dd = String(hoyObj.getDate()).padStart(2, '0');
            fechaEgreso.value = `${yyyy}-${mm}-${dd}`;
        }
    }
}


// Función para alternar labels/placeholders del input 3 y visibilidad de garantía
// Función para alternar labels dinámicos del Bloque 3 y visibilidad de garantía
// Función para cargar habitaciones o servicios guardados en selectInventario
function cargarOpcionesInventario() {
    const selectInv = document.getElementById('selectInventario');
    if (!selectInv) return;

    const selectCat = document.getElementById('selectCategoriaPrincipal');
    const radioActivo = document.querySelector('input[name="tipo_actividad_servicio"]:checked');
    const actividad = selectCat ? selectCat.value : (radioActivo ? radioActivo.value : 'alquiler');

    const valorPrevio = selectInv.value;
    selectInv.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.innerText = 'Seleccionar...';
    selectInv.appendChild(defaultOpt);

    const clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];

    if (actividad === 'alquiler') {
        const habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
        habitaciones.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            const tieneInquilinoActivo = clientes.some(c => c.activo === true && (c.ref === h.nombre || String(c.ref) === String(h.id)));
            const estadoHab = tieneInquilinoActivo ? 'Ocupada' : 'Disponible';
            opt.innerText = `${h.nombre} (${estadoHab})`;
            selectInv.appendChild(opt);
        });
    } else {
        const servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
        const serviciosFiltrados = servicios.filter(s => {
            if (actividad === 'academia' || actividad === 'inscripcion') {
                return !s.tipo || s.tipo === 'academia' || s.tipo === 'inscripcion';
            }
            return !s.tipo || s.tipo === actividad;
        });
        serviciosFiltrados.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            const cantidadInscritos = clientes.filter(c => c.activo === true && (c.ref === s.nombre || (c.ref && s.nombre && c.ref.trim() === s.nombre.trim()) || String(c.ref) === String(s.id))).length;
            opt.innerText = `${s.nombre} (${cantidadInscritos} p.)`;
            selectInv.appendChild(opt);
        });
    }

    const crearOpt = document.createElement('option');
    crearOpt.value = 'crear_nuevo';
    crearOpt.innerText = '+ Crear nuevo...';
    selectInv.appendChild(crearOpt);

    const manualOpt = document.createElement('option');
    manualOpt.value = 'manual';
    manualOpt.innerText = 'Ingresar manualmente';
    selectInv.appendChild(manualOpt);

    if (valorPrevio && Array.from(selectInv.options).some(o => o.value === valorPrevio)) {
        selectInv.value = valorPrevio;
    }
}
window.cargarOpcionesInventario = cargarOpcionesInventario;

// Función para cargar categorías dinámicas en selectCategoriaPrincipal (Fase 3.6)
function cargarCategoriasPrincipales() {
    const selectCat = document.getElementById('selectCategoriaPrincipal');
    if (!selectCat) return;

    const valorPrevio = selectCat.value;
    const servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
    const tiposEstandar = ['alquiler', 'streaming', 'academia', 'otro', 'crear_nuevo', 'nuevo_global'];

    const categoriasPersonalizadas = [...new Set(
        servicios.map(s => s.tipo).filter(t => t && !tiposEstandar.includes(t.toLowerCase()))
    )];

    selectCat.innerHTML = `
        <option value="alquiler">Alquiler de habitación</option>
        <option value="streaming">Streaming o suscripción</option>
        <option value="academia">Inscripción de Alumnos</option>
        <option value="otro">Otro servicio</option>
    `;

    categoriasPersonalizadas.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        selectCat.appendChild(opt);
    });

    const optCrear = document.createElement('option');
    optCrear.value = 'nuevo_global';
    optCrear.innerText = '+ Crear nueva categoría...';
    selectCat.appendChild(optCrear);

    if (valorPrevio && Array.from(selectCat.options).some(o => o.value === valorPrevio)) {
        selectCat.value = valorPrevio;
    } else {
        selectCat.value = 'alquiler';
    }
}
window.cargarCategoriasPrincipales = cargarCategoriasPrincipales;

function actualizarConfiguracionServicio() {
    const selectCat = document.getElementById('selectCategoriaPrincipal');
    const radioActivo = document.querySelector('input[name="tipo_actividad_servicio"]:checked');
    const valor = selectCat ? selectCat.value : (radioActivo ? radioActivo.value : 'alquiler');

    // Input para nueva categoría (Fase 3.6 - nuevo_global)
    const inputNuevaCat = document.getElementById('inputNuevaCategoriaGlobal');
    if (inputNuevaCat) {
        if (valor === 'nuevo_global' || valor === 'crear_nuevo') {
            inputNuevaCat.classList.remove('d-none');
            inputNuevaCat.focus();
        } else {
            inputNuevaCat.classList.add('d-none');
            inputNuevaCat.value = '';
        }
    }

    const lblInventario = document.getElementById('lbl-select-inventario');
    const bloqueGarantia = document.getElementById('bloque-garantia');

    if (valor === 'alquiler') {
        if (lblInventario) lblInventario.innerText = 'Habitación';
        if (bloqueGarantia) {
            bloqueGarantia.classList.remove('d-none');
        }
    } else if (valor === 'streaming') {
        if (lblInventario) lblInventario.innerText = 'Servicio o cuenta';
        if (bloqueGarantia) {
            bloqueGarantia.classList.add('d-none');
            const chkGar = document.getElementById('chk-tiene-garantia');
            if (chkGar) chkGar.checked = false;
            const opcGar = document.getElementById('opciones-garantia');
            if (opcGar) opcGar.classList.add('d-none');
        }
    } else if (valor === 'academia') {
        if (lblInventario) lblInventario.innerText = 'Clase o Curso';
        if (bloqueGarantia) {
            bloqueGarantia.classList.add('d-none');
            const chkGar = document.getElementById('chk-tiene-garantia');
            if (chkGar) chkGar.checked = false;
            const opcGar = document.getElementById('opciones-garantia');
            if (opcGar) opcGar.classList.add('d-none');
        }
    } else {
        // 'nuevo_global', 'otro' o cualquier categoría nueva / personalizada
        if (lblInventario) lblInventario.innerText = 'Ítem o Servicio';
        if (bloqueGarantia) {
            bloqueGarantia.classList.add('d-none');
            const chkGar = document.getElementById('chk-tiene-garantia');
            if (chkGar) chkGar.checked = false;
            const opcGar = document.getElementById('opciones-garantia');
            if (opcGar) opcGar.classList.add('d-none');
        }
    }

    cargarOpcionesInventario();
}
window.actualizarConfiguracionServicio = actualizarConfiguracionServicio;

// Lógica para "+ Crear nuevo..." en selectInventario
function manejarCambioInventario() {
    const selectInv = document.getElementById('selectInventario');
    const contenedorNuevo = document.getElementById('contenedorNuevoItem');
    const inputNuevo = document.getElementById('inputNombreNuevoItem');

    if (!selectInv || !contenedorNuevo) return;

    if (selectInv.value === 'crear_nuevo') {
        contenedorNuevo.classList.remove('d-none');
        if (inputNuevo) {
            inputNuevo.placeholder = "Ej. 305 o Nombre del servicio";
            inputNuevo.focus();
        }
    } else {
        contenedorNuevo.classList.add('d-none');
        if (inputNuevo) inputNuevo.value = '';
    }
}
window.manejarCambioInventario = manejarCambioInventario;

// Regla de Frecuencia: Duración de estadía, límites matemáticos y mutación de radios (Fase 2.8)
function manejarCambioFrecuencia() {
    const selectFrecuencia = document.getElementById('cli-frecuencia');
    const contenedorEstadia = document.getElementById('contenedor-duracion-estadia');
    const lblEstadia = document.getElementById('lbl-duracion-estadia');
    const inputEstadia = document.getElementById('inputDuracionEstadia');
    const inputMonto = document.getElementById('cli-monto');

    const lblOpcion1 = document.getElementById('lblRadioOpcion1');
    const lblOpcion2 = document.getElementById('lblRadioOpcion2');
    const lblOpcion3 = document.getElementById('lblRadioOpcion3');
    const contenedorRadioOpcion3 = document.getElementById('contenedorRadioOpcion3');
    const radioOpcion3 = document.getElementById('radioOpcion3');
    const radioOpcion1 = document.getElementById('radioOpcion1');

    if (!selectFrecuencia) return;
    const freq = selectFrecuencia.value;

    // 1. Configuración de Duración de Estadía según Frecuencia
    if (freq === 'diario') {
        if (inputMonto && document.activeElement === selectFrecuencia) {
            inputMonto.value = '';
            inputMonto.focus();
        }
        if (contenedorEstadia) contenedorEstadia.classList.remove('d-none');
        if (lblEstadia) lblEstadia.innerText = "Cantidad de días";
        if (inputEstadia) {
            inputEstadia.min = "1";
            inputEstadia.max = "6";
            if (!inputEstadia.value || parseInt(inputEstadia.value) < 1) {
                inputEstadia.value = "1";
            }
        }
    } else if (freq === 'semanal') {
        if (contenedorEstadia) contenedorEstadia.classList.remove('d-none');
        if (lblEstadia) lblEstadia.innerText = "Cantidad de semanas";
        if (inputEstadia) {
            inputEstadia.min = "1";
            inputEstadia.max = "3";
            if (!inputEstadia.value || parseInt(inputEstadia.value) < 1) {
                inputEstadia.value = "1";
            }
        }
    } else {
        // Quincenal o Mensual (Continua)
        if (contenedorEstadia) {
            contenedorEstadia.classList.add('d-none');
            if (inputEstadia) inputEstadia.value = '';
        }
    }

    // 2. Mutación de Textos (Opción 1) y Candados de Opciones
    if (freq === 'mensual') {
        if (lblOpcion1) lblOpcion1.innerText = "Pago del primer mes";
        if (lblOpcion2) lblOpcion2.innerText = "Pago incompleto (Genera deuda)";
        if (lblOpcion3) lblOpcion3.innerText = "Meses por adelantado";
        if (contenedorRadioOpcion3) contenedorRadioOpcion3.classList.remove('d-none');
    } else if (freq === 'quincenal') {
        if (lblOpcion1) lblOpcion1.innerText = "Pago de la primera quincena";
        if (lblOpcion2) lblOpcion2.innerText = "Pago incompleto (Genera deuda)";
        if (lblOpcion3) lblOpcion3.innerText = "Quincenas por adelantado";
        // Candado Quincenal: Se oculta por completo la Opción 3
        if (contenedorRadioOpcion3) contenedorRadioOpcion3.classList.add('d-none');
        if (radioOpcion3 && radioOpcion3.checked && radioOpcion1) {
            radioOpcion1.checked = true;
        }
    } else if (freq === 'diario') {
        if (lblOpcion1) lblOpcion1.innerText = "Pago total de la estadía";
        if (lblOpcion2) lblOpcion2.innerText = "Pago de algunos días";
        if (lblOpcion3) lblOpcion3.innerText = "Adelanto (Genera deuda)";
        if (contenedorRadioOpcion3) contenedorRadioOpcion3.classList.remove('d-none');
    } else if (freq === 'semanal') {
        if (lblOpcion1) lblOpcion1.innerText = "Pago total de la estadía";
        if (lblOpcion2) lblOpcion2.innerText = "Pago de algunas semanas";
        if (lblOpcion3) lblOpcion3.innerText = "Adelanto (Genera deuda)";
        if (contenedorRadioOpcion3) contenedorRadioOpcion3.classList.remove('d-none');
    }

    // 3. Actualizar vistas, límites y cálculos dependientes
    actualizarLimitePago();
    manejarCambioModalidadPago();
    actualizarLimitesFechas();
    calcularDeudaAdelanto();
    calcularTotalAdelantado();
}
window.manejarCambioFrecuencia = manejarCambioFrecuencia;

// Lógica de Modalidad de Pago Dinámica: Total, Incompleto/Periodos, Adelanto/Meses por adelantado
function manejarCambioModalidadPago() {
    const radioSeleccionado = document.querySelector('input[name="modalidadPago"]:checked');
    const modalidad = radioSeleccionado ? radioSeleccionado.value : 'opcion1';
    const selectFrecuencia = document.getElementById('cli-frecuencia');
    const freq = selectFrecuencia ? selectFrecuencia.value : 'mensual';

    const divTiempo = document.getElementById('divParcialTiempo');
    const divDinero = document.getElementById('divAdelantoDinero');
    const labelCantidad = document.getElementById('labelCantidadPagada');
    const inputPeriodos = document.getElementById('inputPeriodosPagados');
    const textoTotal = document.getElementById('textoTotalCobrar');
    const labelDinero = document.getElementById('labelMontoDinero');
    const inputAdelanto = document.getElementById('inputMontoAdelanto');

    if (!divTiempo || !divDinero) return;

    if (modalidad === 'opcion1') {
        // Opción 1: Oculta campos extra en cualquier frecuencia
        divTiempo.classList.add('d-none');
        divDinero.classList.add('d-none');
    } else if (modalidad === 'opcion2') {
        if (freq === 'mensual' || freq === 'quincenal') {
            // Opción 2 en Mensual/Quincenal: "Pago incompleto (Genera deuda)"
            divTiempo.classList.add('d-none');
            divDinero.classList.remove('d-none');
            if (labelDinero) labelDinero.innerText = "Monto pagado";
            if (inputAdelanto) inputAdelanto.focus();
            actualizarLimitesFechas();
            calcularDeudaAdelanto();
        } else {
            // Opción 2 en Diario/Semanal: "Pago de algunos días/semanas"
            divTiempo.classList.remove('d-none');
            divDinero.classList.add('d-none');
            if (textoTotal) textoTotal.classList.add('d-none');
            if (labelCantidad) {
                labelCantidad.innerText = (freq === 'diario') ? "Días pagados" : "Semanas pagadas";
            }
            actualizarLimitePago();
            if (inputPeriodos) inputPeriodos.focus();
        }
    } else if (modalidad === 'opcion3') {
        if (freq === 'mensual') {
            // Opción 3 en Mensual: "Meses por adelantado" (min="2" value="2")
            divTiempo.classList.remove('d-none');
            divDinero.classList.add('d-none');
            if (textoTotal) textoTotal.classList.remove('d-none');
            if (labelCantidad) {
                labelCantidad.innerText = "Cantidad de meses";
            }
            if (inputPeriodos) {
                inputPeriodos.removeAttribute('max');
                inputPeriodos.min = "2";
                if (!inputPeriodos.value || parseInt(inputPeriodos.value) < 2) {
                    inputPeriodos.value = "2";
                }
                inputPeriodos.focus();
            }
            calcularTotalAdelantado();
        } else if (freq === 'quincenal') {
            // Quincenal: Opción 3 oculta
            divTiempo.classList.add('d-none');
            divDinero.classList.add('d-none');
        } else {
            // Opción 3 en Diario/Semanal: "Adelanto (Genera deuda)"
            divTiempo.classList.add('d-none');
            divDinero.classList.remove('d-none');
            if (labelDinero) labelDinero.innerText = "Adelanto (S/)";
            if (inputAdelanto) inputAdelanto.focus();
            actualizarLimitesFechas();
            calcularDeudaAdelanto();
        }
    }
}
window.manejarCambioModalidadPago = manejarCambioModalidadPago;

// Blindaje de Adelantos (Cero Saldos Negativos) y Matemática de Deuda:
// Total = Importe * (Estadía || 1)
// Si Number(inputAdelanto.value) > Total => forzar inputAdelanto.value = Total
// Deuda = Total - Adelanto
function calcularDeudaAdelanto() {
    const selectFrecuencia = document.getElementById('cli-frecuencia');
    const inputMonto = document.getElementById('cli-monto');
    const inputEstadia = document.getElementById('inputDuracionEstadia');
    const inputAdelanto = document.getElementById('inputMontoAdelanto');
    const textoDeuda = document.getElementById('textoDeudaRestante');

    if (!textoDeuda) return;

    const freq = selectFrecuencia ? selectFrecuencia.value : 'mensual';
    const importe = parseFloat(inputMonto && inputMonto.value ? inputMonto.value : 0) || 0;

    let total = importe;
    if (freq === 'diario' || freq === 'semanal') {
        const estadia = parseInt(inputEstadia && inputEstadia.value ? inputEstadia.value : 1) || 1;
        total = importe * estadia;
    }

    // Blindaje de Adelantos: Cero Saldos Negativos (Fase 2.8)
    if (inputAdelanto && inputAdelanto.value !== '') {
        const valAdelanto = Number(inputAdelanto.value);
        if (valAdelanto > total) {
            inputAdelanto.value = total;
        }
    }

    const adelanto = parseFloat(inputAdelanto && inputAdelanto.value ? inputAdelanto.value : 0) || 0;
    const deuda = Math.max(0, total - adelanto);
    textoDeuda.innerText = `Deuda restante: S/ ${deuda.toFixed(2)}`;
}
window.calcularDeudaAdelanto = calcularDeudaAdelanto;
window.calcularDeuda = calcularDeudaAdelanto;

// Total a cobrar para Opción 3 en Mensual (Meses por adelantado)
function calcularTotalAdelantado() {
    const inputMonto = document.getElementById('cli-monto');
    const inputPeriodos = document.getElementById('inputPeriodosPagados');
    const textoTotal = document.getElementById('textoTotalCobrar');

    if (!textoTotal) return;

    const importe = parseFloat(inputMonto && inputMonto.value ? inputMonto.value : 0) || 0;
    const cantPeriodos = parseInt(inputPeriodos && inputPeriodos.value ? inputPeriodos.value : 1) || 1;
    const total = importe * cantPeriodos;

    textoTotal.innerText = `Total a cobrar: S/ ${total.toFixed(2)}`;
}
window.calcularTotalAdelantado = calcularTotalAdelantado;

// Controlador Universal de Fechas (Fase 2.8)
// - Toma "Fecha del primer cobro" (o Date.now() si vacía) como fechaBase.
// - Setea MIN = fechaBase en Deuda y Garantía.
// - Setea MAX en Deuda y Garantía según Frecuencia:
//   Diario: fechaBase + DuracionEstadia (días)
//   Semanal: fechaBase + (DuracionEstadia * 7) (días)
//   Quincenal: fechaBase + 15 días
//   Mensual: fechaBase + 30 días
// - Si el valor actual excede el nuevo max o es menor al min, blanquea el input (value = '').
function actualizarLimitesFechas() {
    const selectFrecuencia = document.getElementById('cli-frecuencia');
    const inputFechaInicio = document.getElementById('cli-fecha-inicio');
    const inputEstadia = document.getElementById('inputDuracionEstadia');
    const inputFechaDeuda = document.getElementById('inputFechaCobroDeuda');
    const inputFechaGarantia = document.getElementById('cli-garantia-fecha');

    // 1. Obtener fechaBase (Fecha del primer cobro o Date.now())
    let fechaBaseObj;
    if (inputFechaInicio && inputFechaInicio.value && inputFechaInicio.value.includes('-')) {
        const [y, m, d] = inputFechaInicio.value.split('-').map(Number);
        fechaBaseObj = new Date(y, m - 1, d);
    } else {
        fechaBaseObj = new Date();
    }

    const yyyyBase = fechaBaseObj.getFullYear();
    const mmBase = String(fechaBaseObj.getMonth() + 1).padStart(2, '0');
    const ddBase = String(fechaBaseObj.getDate()).padStart(2, '0');
    const fechaBaseStr = `${yyyyBase}-${mmBase}-${ddBase}`;

    // 2. Calcular tope máximo sumando días a fechaBase según la Frecuencia
    const freq = selectFrecuencia ? selectFrecuencia.value : 'mensual';
    let diasASumar = 30;

    if (freq === 'diario') {
        const estadia = parseInt(inputEstadia && inputEstadia.value ? inputEstadia.value : 1) || 1;
        diasASumar = estadia;
    } else if (freq === 'semanal') {
        const estadia = parseInt(inputEstadia && inputEstadia.value ? inputEstadia.value : 1) || 1;
        diasASumar = estadia * 7;
    } else if (freq === 'quincenal') {
        diasASumar = 15;
    } else if (freq === 'mensual') {
        diasASumar = 30;
    }

    const fechaMaxObj = new Date(fechaBaseObj.getFullYear(), fechaBaseObj.getMonth(), fechaBaseObj.getDate());
    fechaMaxObj.setDate(fechaMaxObj.getDate() + diasASumar);

    const yyyyMax = fechaMaxObj.getFullYear();
    const mmMax = String(fechaMaxObj.getMonth() + 1).padStart(2, '0');
    const ddMax = String(fechaMaxObj.getDate()).padStart(2, '0');
    const fechaMaxStr = `${yyyyMax}-${mmMax}-${ddMax}`;

    // 3. Aplicar MIN y MAX a AMBOS inputs (Deuda y Garantía) y blanquear si está fuera de rango
    [inputFechaDeuda, inputFechaGarantia].forEach(input => {
        if (!input) return;
        input.min = fechaBaseStr;
        input.max = fechaMaxStr;

        if (input.value) {
            if (input.value < input.min || input.value > input.max) {
                input.value = '';
            }
        }
    });
}
window.actualizarLimitesFechas = actualizarLimitesFechas;
window.calcularFechaLimiteDeuda = actualizarLimitesFechas;

// Regla de "N-1" para Diario y Semanal, y Candados de Periodos
function actualizarLimitePago() {
    const selectFrecuencia = document.getElementById('cli-frecuencia');
    const inputEstadia = document.getElementById('inputDuracionEstadia');
    const inputPeriodos = document.getElementById('inputPeriodosPagados');
    const contenedorRadioOpcion2 = document.getElementById('contenedorRadioOpcion2');
    const radioOpcion2 = document.getElementById('radioOpcion2');
    const radioOpcion1 = document.getElementById('radioOpcion1');

    if (!selectFrecuencia) return;
    const freq = selectFrecuencia.value;

    if (freq === 'diario' || freq === 'semanal') {
        const estadia = parseInt(inputEstadia && inputEstadia.value ? inputEstadia.value : 1) || 1;

        if (estadia <= 1) {
            if (contenedorRadioOpcion2) contenedorRadioOpcion2.classList.add('d-none');
            if (radioOpcion2 && radioOpcion2.checked && radioOpcion1) {
                radioOpcion1.checked = true;
                manejarCambioModalidadPago();
            }
        } else {
            if (contenedorRadioOpcion2) contenedorRadioOpcion2.classList.remove('d-none');
            if (inputPeriodos) {
                const maxPeriodos = estadia - 1;
                inputPeriodos.min = "1";
                inputPeriodos.max = String(maxPeriodos);
                if (parseInt(inputPeriodos.value) > maxPeriodos) {
                    inputPeriodos.value = String(maxPeriodos);
                }
                if (!inputPeriodos.value || parseInt(inputPeriodos.value) < 1) {
                    inputPeriodos.value = "1";
                }
            }
        }
    } else if (freq === 'mensual') {
        if (contenedorRadioOpcion2) contenedorRadioOpcion2.classList.remove('d-none');
        if (inputPeriodos) {
            inputPeriodos.removeAttribute('max');
            inputPeriodos.min = "2";
            if (!inputPeriodos.value || parseInt(inputPeriodos.value) < 2) {
                inputPeriodos.value = "2";
            }
        }
    } else if (freq === 'quincenal') {
        if (contenedorRadioOpcion2) contenedorRadioOpcion2.classList.remove('d-none');
        if (inputPeriodos) {
            inputPeriodos.removeAttribute('max');
            inputPeriodos.min = "1";
        }
    }
}
window.actualizarLimitePago = actualizarLimitePago;

// Controlador Principal de Guardado Unificado (Fase 3 - Esquema v2.0)
function guardarRegistroUnificado(e) {
    if (e && e.preventDefault) e.preventDefault();

    // 1. Bifurcación Principal: ¿Cliente o Egreso?
    const radioEgreso = document.getElementById('reg-raiz-egreso');
    const esEgreso = radioEgreso ? radioEgreso.checked : false;

    if (esEgreso) {
        // ==========================================
        // --- CASO A (Egreso) ---
        // ==========================================
        const formEgreso = document.getElementById('form-nuevo-egreso');
        if (formEgreso && formEgreso.reportValidity && !formEgreso.reportValidity()) {
            return;
        }

        const inputMotivo = document.getElementById('egr-motivo');
        const inputMonto = document.getElementById('egr-monto');
        const inputFecha = document.getElementById('egr-fecha');
        const selectCat = document.getElementById('egr-categoria');

        const fechaVal = (inputFecha && inputFecha.value) ? inputFecha.value : new Date().toISOString().split('T')[0];
        const [anio, mes, dia] = fechaVal.split('-').map(Number);

        const nuevoEgreso = {
            id: Date.now(),
            motivo: inputMotivo ? inputMotivo.value.trim() : 'Gasto operativo',
            monto: parseFloat(inputMonto ? inputMonto.value : 0) || 0,
            fecha: fechaVal,
            dia: dia || 1,
            mes: mes || (new Date().getMonth() + 1),
            año: anio || new Date().getFullYear(),
            categoria: selectCat ? selectCat.value : 'Otros'
        };

        let egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
        egresos.push(nuevoEgreso);
        localStorage.setItem('aldia_egresos', JSON.stringify(egresos));

        if (formEgreso) formEgreso.reset();
        reiniciarVistaRegistro();
        if (typeof mostrarToastDeshacer === 'function') {
            mostrarToastDeshacer("Registro guardado correctamente");
        }
        alert("Registro guardado correctamente");
        renderizarDashboard();
        renderizarEstadisticas();
        navegar('dashboard');
        return;
    }

    // ==========================================
    // --- CASO B (Cliente y cobros) ---
    // ==========================================
    const formCliente = document.getElementById('form-nuevo-cliente');
    if (formCliente && formCliente.reportValidity && !formCliente.reportValidity()) {
        return;
    }

    // 1. Capturar datos de Persona y Configuración (Fase 2.1 y Fase 3.6)
    const selectCat = document.getElementById('selectCategoriaPrincipal');
    const radioActividad = document.querySelector('input[name="tipo_actividad_servicio"]:checked');
    let tipoServicio = selectCat ? selectCat.value : (radioActividad ? radioActividad.value : 'alquiler');

    if (tipoServicio === 'nuevo_global' || tipoServicio === 'crear_nuevo') {
        const inputNuevaCat = document.getElementById('inputNuevaCategoriaGlobal');
        const catPersonalizada = inputNuevaCat ? inputNuevaCat.value.trim() : '';
        if (!catPersonalizada) {
            alert("⚠️ Por favor ingresa el nombre de la nueva categoría.");
            if (inputNuevaCat) inputNuevaCat.focus();
            return;
        }
        tipoServicio = catPersonalizada;
    }

    const nombre = document.getElementById('cli-nombre') ? document.getElementById('cli-nombre').value.trim() : '';
    const apellido = document.getElementById('cli-apellido') ? document.getElementById('cli-apellido').value.trim() : '';
    const telefono = document.getElementById('cli-telefono') ? document.getElementById('cli-telefono').value.trim() : '';
    const monto = parseFloat(document.getElementById('cli-monto') ? document.getElementById('cli-monto').value : 0) || 0;
    const selectFrecuencia = document.getElementById('cli-frecuencia');
    const frecuencia = selectFrecuencia ? selectFrecuencia.value : 'mensual';

    const inputEstadia = document.getElementById('inputDuracionEstadia');
    const duracionEstadia = (frecuencia === 'diario' || frecuencia === 'semanal')
        ? (parseInt(inputEstadia && inputEstadia.value ? inputEstadia.value : 1) || 1)
        : null;

    const inputFechaInicio = document.getElementById('cli-fecha-inicio');
    const fechaInput = (inputFechaInicio && inputFechaInicio.value)
        ? inputFechaInicio.value
        : new Date().toISOString().split('T')[0];
    const [anioIni, mesIni, diaIni] = fechaInput.split('-').map(Number);

    // 2. Gestión de Inventario (aldia_habitaciones / aldia_servicios)
    const selectInv = document.getElementById('selectInventario');
    const valorInv = selectInv ? selectInv.value : '';
    const inputNuevo = document.getElementById('inputNombreNuevoItem');
    const nombreNuevo = inputNuevo ? inputNuevo.value.trim() : '';

    let nombreRef = '';
    let habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
    let servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];

    if (valorInv === 'crear_nuevo' || valorInv === 'nuevo') {
        nombreRef = nombreNuevo || (tipoServicio === 'alquiler' ? 'Habitación' : 'Servicio');
        if (tipoServicio === 'alquiler') {
            habitaciones.push({
                id: Date.now(),
                nombre: nombreRef,
                precio_base: monto,
                frecuencia_base: frecuencia,
                estado: 'Ocupada'
            });
            localStorage.setItem('aldia_habitaciones', JSON.stringify(habitaciones));
        } else {
            servicios.push({
                id: Date.now(),
                nombre: nombreRef,
                precio_base: monto,
                frecuencia_base: frecuencia,
                tipo: tipoServicio
            });
            localStorage.setItem('aldia_servicios', JSON.stringify(servicios));
        }
    } else if (valorInv === 'manual') {
        nombreRef = nombreNuevo || (tipoServicio === 'alquiler' ? 'Habitación' : 'Servicio');
    } else if (valorInv) {
        if (tipoServicio === 'alquiler') {
            const habExistente = habitaciones.find(h => String(h.id) === String(valorInv) || h.nombre === valorInv);
            if (habExistente) {
                habExistente.estado = 'Ocupada';
                nombreRef = habExistente.nombre;
                localStorage.setItem('aldia_habitaciones', JSON.stringify(habitaciones));
            } else {
                nombreRef = valorInv;
            }
        } else {
            const servExistente = servicios.find(s => String(s.id) === String(valorInv) || s.nombre === valorInv);
            if (servExistente) {
                if (servExistente.estado) {
                    delete servExistente.estado;
                    localStorage.setItem('aldia_servicios', JSON.stringify(servicios));
                }
                nombreRef = servExistente.nombre;
            } else {
                nombreRef = valorInv;
            }
        }
    } else {
        nombreRef = nombreNuevo || (tipoServicio === 'alquiler' ? 'Habitación' : 'Servicio');
    }

    // 3. Capturar datos de Garantía (si aplica)
    const chkGarantia = document.getElementById('chk-tiene-garantia');
    const tieneGarantia = (tipoServicio === 'alquiler') && chkGarantia && chkGarantia.checked;
    const montoGarantia = tieneGarantia
        ? (parseFloat(document.getElementById('cli-garantia-monto') ? document.getElementById('cli-garantia-monto').value : 0) || 0)
        : 0;

    const radioGarPagada = document.getElementById('garantia-pagada-ahora');
    const pagadaGarantia = tieneGarantia && radioGarPagada ? radioGarPagada.checked : false;
    const inputFechaGar = document.getElementById('cli-garantia-fecha');
    const fechaGarantia = (tieneGarantia && !pagadaGarantia && inputFechaGar) ? inputFechaGar.value : '';

    if (tieneGarantia) {
        if (montoGarantia <= 0) {
            alert("⚠️ ¡Atención!\nHas indicado que aplica garantía, pero el monto es 0 o está vacío.");
            const elMonto = document.getElementById('cli-garantia-monto');
            if (elMonto) elMonto.focus();
            return;
        }
        if (!pagadaGarantia && !fechaGarantia) {
            alert("⚠️ ¡Atención!\nHas indicado que hay una garantía pendiente, pero no has seleccionado la fecha de cobro.");
            if (inputFechaGar) inputFechaGar.focus();
            return;
        }
    }

    // 4. Gestión del Cliente (aldia_clientes)
    const idCliente = Date.now();
    const nuevoCliente = {
        id: idCliente,
        tipo_servicio: tipoServicio,
        nombre: nombre,
        apellido: apellido,
        telefono: telefono,
        monto: monto,
        frecuencia: frecuencia,
        duracion_estadia: duracionEstadia,
        ref: nombreRef,
        fecha_inicio: fechaInput,
        dia: diaIni || 1,
        activo: true,
        garantia_monto: tieneGarantia ? montoGarantia : 0,
        garantia_pagada: tieneGarantia ? pagadaGarantia : false,
        garantia_fecha: fechaGarantia
    };

    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    clientes.push(nuevoCliente);
    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));

    // 5. Gestión de Pagos e Ingresos (aldia_pagos) - Fase 3.2 Estructura Estricta
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    const chkPagoInicial = document.getElementById('chk-pago-inicial');
    const tienePagoInicial = chkPagoInicial ? chkPagoInicial.checked : false;

    // Cálculo dinámico universal del Total según la frecuencia seleccionada
    const totalCalculado = (frecuencia === 'diario' || frecuencia === 'semanal')
        ? (monto * (duracionEstadia || 1))
        : monto;

    const inputFechaDeuda = document.getElementById('inputFechaCobroDeuda');
    const fechaVencDeuda = (inputFechaDeuda && inputFechaDeuda.value) ? inputFechaDeuda.value : fechaInput;

    if (!tienePagoInicial) {
        // Sin pago inicial: Cuota pendiente total
        pagos.push({
            id: Date.now() + 1,
            cliente_id: idCliente,
            mes: mesIni,
            año: anioIni,
            monto: totalCalculado,
            pagado: false,
            metodo: "",
            historico: `${nombre} ${apellido}`.trim(),
            es_garantia: false,
            fecha_vencimiento: fechaInput
        });
    } else {
        const radioModalidad = document.querySelector('input[name="modalidadPago"]:checked');
        const modalidad = radioModalidad ? radioModalidad.value : 'opcion1';

        if (modalidad === 'opcion1') {
            // Pago Total de la estadía o periodo
            let idIngreso1 = Date.now();
            pagos.push({
                id: idIngreso1,
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: totalCalculado,
                pagado: true,
                metodo: 'Efectivo',
                historico: `${nombre} ${apellido}`.trim(),
                es_garantia: false,
                fecha_pago_real: Date.now(),
                id_recibo: "REC-" + idIngreso1.toString().slice(-6),
                fecha_emision: formatearFechaHora(idIngreso1)
            });
        } else if ((frecuencia === 'diario' || frecuencia === 'semanal') && modalidad === 'opcion2') {
            // Pago Parcial (Tiempo) en Diario/Semanal
            const inputPeriodos = document.getElementById('inputPeriodosPagados');
            const periodosPagados = parseInt(inputPeriodos && inputPeriodos.value ? inputPeriodos.value : 1) || 1;
            const montoPagado = monto * periodosPagados;

            // Registro 1: Ingreso de hoy
            let idIngreso2 = Date.now();
            pagos.push({
                id: idIngreso2,
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: montoPagado,
                pagado: true,
                metodo: 'Efectivo',
                historico: `${nombre} ${apellido} (Pago parcial)`.trim(),
                es_garantia: false,
                fecha_pago_real: Date.now(),
                id_recibo: "REC-" + idIngreso2.toString().slice(-6),
                fecha_emision: formatearFechaHora(idIngreso2)
            });

            // Registro 2 (La Deuda): Periodos restantes
            const totalEstadia = duracionEstadia || 1;
            if (periodosPagados < totalEstadia) {
                const montoRestante = monto * (totalEstadia - periodosPagados);
                pagos.push({
                    id: Date.now() + 1,
                    cliente_id: idCliente,
                    mes: mesIni,
                    año: anioIni,
                    monto: montoRestante,
                    pagado: false,
                    metodo: "",
                    historico: `${nombre} ${apellido}`.trim(),
                    es_garantia: false,
                    fecha_vencimiento: fechaVencDeuda
                });
            }
        } else if (
            ((frecuencia === 'diario' || frecuencia === 'semanal') && modalidad === 'opcion3') ||
            ((frecuencia === 'mensual' || frecuencia === 'quincenal') && modalidad === 'opcion2')
        ) {
            // Adelanto (Dinero) / Pago Incompleto (Diario, Semanal, Mensual, Quincenal)
            const inputAdelanto = document.getElementById('inputMontoAdelanto');
            const montoAdelanto = parseFloat(inputAdelanto && inputAdelanto.value ? inputAdelanto.value : 0) || 0;
            const deudaRestante = Math.max(0, totalCalculado - montoAdelanto);

            // Registro 1: El ingreso de hoy (Adelanto)
            let idIngreso3 = Date.now();
            pagos.push({
                id: idIngreso3,
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: montoAdelanto,
                pagado: true,
                metodo: 'Efectivo',
                historico: `${nombre} ${apellido} (Adelanto)`.trim(),
                es_garantia: false,
                fecha_pago_real: Date.now(),
                id_recibo: "REC-" + idIngreso3.toString().slice(-6),
                fecha_emision: formatearFechaHora(idIngreso3)
            });

            // Registro 2 (La Deuda): Estructura ESTRICTA auditada en Fase 3.2
            if (deudaRestante > 0) {
                pagos.push({
                    id: Date.now() + 1,
                    cliente_id: idCliente,
                    mes: mesIni,
                    año: anioIni,
                    monto: deudaRestante,
                    pagado: false,
                    metodo: "",
                    historico: `${nombre} ${apellido}`.trim(),
                    es_garantia: false,
                    fecha_vencimiento: fechaVencDeuda
                });
            }
        } else if ((frecuencia === 'mensual' || frecuencia === 'quincenal') && modalidad === 'opcion3') {
            // Meses por adelantado
            const inputPeriodos = document.getElementById('inputPeriodosPagados');
            const cantMeses = parseInt(inputPeriodos && inputPeriodos.value ? inputPeriodos.value : 2) || 2;

            for (let i = 0; i < cantMeses; i++) {
                let mesCobro = mesIni + i;
                let añoCobro = anioIni;
                while (mesCobro > 12) {
                    mesCobro -= 12;
                    añoCobro++;
                }
                let idIngreso4 = Date.now() + i;
                pagos.push({
                    id: idIngreso4,
                    cliente_id: idCliente,
                    mes: mesCobro,
                    año: añoCobro,
                    monto: monto,
                    pagado: true,
                    metodo: 'Efectivo',
                    historico: `${nombre} ${apellido}`.trim(),
                    es_garantia: false,
                    fecha_pago_real: Date.now(),
                    id_recibo: "REC-" + idIngreso4.toString().slice(-6),
                    fecha_emision: formatearFechaHora(idIngreso4)
                });
            }
        }
    }

    // 6. Registro de Garantía en aldia_pagos (si aplica)
    if (tieneGarantia && montoGarantia > 0) {
        if (pagadaGarantia) {
            let idIngresoGar = Date.now() + 50;
            pagos.push({
                id: idIngresoGar,
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: montoGarantia,
                pagado: true,
                metodo: 'Efectivo',
                historico: `${nombre} (Garantía)`.trim(),
                es_garantia: true,
                fecha_pago_real: Date.now(),
                id_recibo: "REC-" + idIngresoGar.toString().slice(-6),
                fecha_emision: formatearFechaHora(idIngresoGar)
            });
        } else {
            pagos.push({
                id: Date.now() + 50,
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: montoGarantia,
                pagado: false,
                metodo: '',
                historico: `${nombre} (Garantía)`.trim(),
                es_garantia: true,
                fecha_vencimiento: fechaGarantia
            });
        }
    }

    localStorage.setItem('aldia_pagos', JSON.stringify(pagos));

    // 7. Feedback, Actualizaciones de UI y Navegación
    if (formCliente) formCliente.reset();
    reiniciarVistaRegistro();

    if (typeof mostrarToastDeshacer === 'function') {
        mostrarToastDeshacer("Registro guardado correctamente");
    }
    alert("Registro guardado correctamente");

    generarDeudasDelMes();
    renderizarDashboard();
    renderizarEstadisticas();
    navegar('dashboard');
}
window.guardarRegistroUnificado = guardarRegistroUnificado;
window.guardarNuevoCliente = guardarRegistroUnificado;
window.guardarNuevoEgreso = guardarRegistroUnificado;

// Función para reiniciar y limpiar completamente la vista de registro
function reiniciarVistaRegistro() {
    const radioClienteRaiz = document.getElementById('reg-raiz-cliente');
    if (radioClienteRaiz) {
        radioClienteRaiz.checked = true;
    }
    renderizarFormularioRegistro();
}
window.reiniciarVistaRegistro = reiniciarVistaRegistro;

function iniciarModuloRegistro() {
    const radios = document.querySelectorAll('input[name="tipo_registro_raiz"]');
    radios.forEach(r => {
        r.addEventListener('change', renderizarFormularioRegistro);
    });

    const btnGuardar = document.getElementById('btnGuardarRegistroUnificado') || document.getElementById('btn-guardar-registro');
    if (btnGuardar) {
        btnGuardar.onclick = guardarRegistroUnificado;
    }

    renderizarFormularioRegistro();
}


// ==========================================
// --- MÓDULO: GESTOR DE INVENTARIO Y OCUPACIÓN (Fase 4.0) ---
// ==========================================
let modalGestorInstancia = null;

function abrirGestorInventario() {
    renderizarGestorInventario();
    const modalEl = document.getElementById('modalGestorInventario');
    if (modalEl) {
        if (!modalGestorInstancia) {
            modalGestorInstancia = new bootstrap.Modal(modalEl);
        }
        modalGestorInstancia.show();
    }
}
window.abrirGestorInventario = abrirGestorInventario;

function renderizarGestorInventario() {
    const habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
    const servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
    const clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];

    renderizarTabHabitaciones(habitaciones, clientes);
    renderizarTabServicios(servicios, clientes);
    renderizarTabCategorias(servicios, clientes);
}
window.renderizarGestorInventario = renderizarGestorInventario;

function renderizarTabHabitaciones(habitaciones, clientes) {
    const cont = document.getElementById('contenedor-gestor-habitaciones');
    if (!cont) return;

    if (habitaciones.length === 0) {
        cont.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-bed fa-2x mb-2 opacity-50"></i>
                <p class="mb-0 small">No hay habitaciones registradas en el inventario.</p>
            </div>`;
        return;
    }

    let html = '';
    habitaciones.forEach(h => {
        const inquilino = clientes.find(c => c.activo === true && (c.ref === h.nombre || String(c.ref) === String(h.id)));
        
        let badge = '';
        let botonTrasladar = '';
        if (inquilino) {
            badge = `<span class="badge bg-danger text-white"><i class="fas fa-user-lock me-1"></i>Ocupada por: ${inquilino.nombre}</span>`;
            const nomInq = (inquilino.nombre || '').replace(/'/g, "\\'");
            const nomHab = (h.nombre || '').replace(/'/g, "\\'");
            botonTrasladar = `<button type="button" class="btn btn-info btn-sm text-white" onclick="abrirModalTraslado(${inquilino.id}, '${nomInq}', '${nomHab}')"><i class="fas fa-exchange-alt me-1"></i>Trasladar</button>`;
        } else {
            badge = `<span class="badge bg-success text-white"><i class="fas fa-check-circle me-1"></i>Disponible</span>`;
        }

        html += `
        <div class="card border rounded-3 p-3 mb-2 shadow-sm bg-white">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <h6 class="fw-bold mb-1 text-dark">${h.nombre}</h6>
                    <div class="text-muted small">
                        Precio base: <span class="fw-semibold text-dark">S/ ${parseFloat(h.precio_base || 0).toFixed(2)}</span>
                        ${h.frecuencia_base ? `<span class="badge bg-light text-dark border ms-1">${h.frecuencia_base}</span>` : ''}
                    </div>
                    <div class="mt-2">
                        ${badge}
                    </div>
                </div>
                <div class="d-flex gap-1">
                    ${botonTrasladar}
                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="editarHabitacionGestor(${h.id})">
                        <i class="fas fa-edit me-1"></i>Editar
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="eliminarHabitacionGestor(${h.id})">
                        <i class="fas fa-trash-alt me-1"></i>Eliminar
                    </button>
                </div>
            </div>
        </div>`;
    });

    cont.innerHTML = html;
}

function renderizarTabServicios(servicios, clientes) {
    const cont = document.getElementById('contenedor-gestor-servicios');
    if (!cont) return;

    if (servicios.length === 0) {
        cont.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-chalkboard-teacher fa-2x mb-2 opacity-50"></i>
                <p class="mb-0 small">No hay servicios o clases registrados.</p>
            </div>`;
        return;
    }

    let itemsHtml = '';
    servicios.forEach((s, idx) => {
        const inscritos = clientes.filter(c => c.activo === true && (c.ref === s.nombre || (c.ref && s.nombre && c.ref.trim() === s.nombre.trim()) || String(c.ref) === String(s.id)));
        const cantidadInscritos = inscritos.length;

        let categoriaNombre = s.tipo || s.tipo_servicio || 'Servicio';
        if (categoriaNombre.toLowerCase() === 'academia') categoriaNombre = 'Inscripción de Alumnos';
        else if (categoriaNombre.toLowerCase() === 'streaming') categoriaNombre = 'Streaming';
        else if (categoriaNombre.toLowerCase() === 'otro') categoriaNombre = 'Otro servicio';

        const collapseId = `collapse-servicio-${s.id || idx}`;
        const headingId = `heading-servicio-${s.id || idx}`;

        const inscritosHtml = cantidadInscritos > 0
            ? `<ul class="list-group list-group-flush mb-0">
                ${inscritos.map(c => `
                    <li class="list-group-item px-0 py-1 small d-flex align-items-center bg-transparent text-dark">
                        <i class="fas fa-user text-muted me-2"></i>${c.nombre}
                    </li>
                `).join('')}
               </ul>`
            : `<div class="text-muted small fst-italic">No hay alumnos inscritos.</div>`;

        itemsHtml += `
        <div class="accordion-item border rounded-3 mb-2 shadow-sm overflow-hidden bg-white">
            <h2 class="accordion-header" id="${headingId}">
                <button class="accordion-button collapsed py-2 px-3" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                    <div class="d-flex align-items-center justify-content-between flex-grow-1 me-3 flex-wrap gap-2">
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-light text-primary border small fw-bold">${categoriaNombre}</span>
                            <span class="fw-bold text-dark">${s.nombre}</span>
                        </div>
                        <div>
                            <span class="badge ${cantidadInscritos > 0 ? 'bg-primary' : 'bg-secondary'} text-white">
                                <i class="fas ${cantidadInscritos > 0 ? 'fa-users' : 'fa-user-slash'} me-1"></i>Inscritos: ${cantidadInscritos}
                            </span>
                        </div>
                    </div>
                </button>
            </h2>
            <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#accordionServicios">
                <div class="accordion-body p-3 bg-light">
                    <div class="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom flex-wrap gap-2">
                        <div class="text-muted small">
                            Precio: <span class="fw-semibold text-dark">S/ ${parseFloat(s.precio_base || 0).toFixed(2)}</span>
                            ${s.frecuencia_base ? `<span class="badge bg-white text-dark border ms-1">${s.frecuencia_base}</span>` : ''}
                        </div>
                        <div class="d-flex gap-1">
                            <button type="button" class="btn btn-outline-primary btn-sm" onclick="editarServicioGestor(${s.id})">
                                <i class="fas fa-edit me-1"></i>Editar
                            </button>
                            <button type="button" class="btn btn-outline-danger btn-sm" onclick="eliminarServicioGestor(${s.id})">
                                <i class="fas fa-trash-alt me-1"></i>Eliminar
                            </button>
                        </div>
                    </div>
                    <div>
                        <div class="fw-bold small text-muted mb-1">Inscritos:</div>
                        ${inscritosHtml}
                    </div>
                </div>
            </div>
        </div>`;
    });

    cont.innerHTML = `<div class="accordion" id="accordionServicios">${itemsHtml}</div>`;
}

function renderizarTabCategorias(servicios, clientes) {
    const cont = document.getElementById('contenedor-gestor-categorias');
    if (!cont) return;

    // Extrae un Set único de tipo_servicio desde aldia_servicios (excluyendo los nativos: alquiler, streaming, academia)
    const nativos = ['alquiler', 'streaming', 'academia', 'otro', 'crear_nuevo', 'nuevo_global'];
    const setCategorias = new Set();

    servicios.forEach(s => {
        const cat = s.tipo || s.tipo_servicio;
        if (cat && !nativos.includes(cat.trim().toLowerCase())) {
            setCategorias.add(cat.trim());
        }
    });

    clientes.forEach(c => {
        const cat = c.tipo_servicio;
        if (cat && !nativos.includes(cat.trim().toLowerCase())) {
            setCategorias.add(cat.trim());
        }
    });

    const listaCategorias = Array.from(setCategorias);

    if (listaCategorias.length === 0) {
        cont.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-tags fa-2x mb-2 opacity-50"></i>
                <p class="mb-0 small">No hay categorías personalizadas creadas aún.</p>
                <p class="text-muted" style="font-size: 0.75rem;">Puedes crear nuevas líneas de negocio desde el registro seleccionando "+ Crear nueva categoría...".</p>
            </div>`;
        return;
    }

    let html = '';
    listaCategorias.forEach(catNombre => {
        html += `
        <div class="card border rounded-3 p-3 mb-2 shadow-sm bg-white">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-primary-subtle text-primary p-2 rounded-circle">
                        <i class="fas fa-tag"></i>
                    </span>
                    <h6 class="fw-bold mb-0 text-dark">${catNombre}</h6>
                </div>
                <div class="d-flex gap-1">
                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="editarCategoriaGestor('${catNombre.replace(/'/g, "\\'")}')">
                        <i class="fas fa-edit me-1"></i>Editar
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="eliminarCategoriaGestor('${catNombre.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash-alt me-1"></i>Eliminar
                    </button>
                </div>
            </div>
        </div>`;
    });

    cont.innerHTML = html;
}


// ==========================================
// --- ACCIONES GESTOR DE INVENTARIO (Fase 4.1) ---
// ==========================================

function eliminarHabitacionGestor(id) {
    let habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
    const h = habitaciones.find(item => String(item.id) === String(id));
    if (!h) return;

    const clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    const enUso = clientes.some(c => c.activo === true && (c.ref === h.nombre || (c.ref && h.nombre && c.ref.trim() === h.nombre.trim()) || String(c.ref) === String(h.id)));

    if (enUso) {
        alert("No puedes eliminar esto porque hay clientes activos usándolo.");
        return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar la habitación "${h.nombre}"?`)) return;

    if (typeof guardarSnapshot === 'function') guardarSnapshot();
    habitaciones = habitaciones.filter(item => String(item.id) !== String(id));
    localStorage.setItem('aldia_habitaciones', JSON.stringify(habitaciones));

    renderizarGestorInventario();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
}
window.eliminarHabitacionGestor = eliminarHabitacionGestor;

function editarHabitacionGestor(id) {
    let habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
    let servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];

    const h = habitaciones.find(item => String(item.id) === String(id));
    if (!h) return;

    const nuevoNombre = prompt("Ingresa el nuevo nombre:", h.nombre);
    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim() === h.nombre) return;

    if (typeof guardarSnapshot === 'function') guardarSnapshot();
    const nombreAntiguo = h.nombre;
    const nombreNuevo = nuevoNombre.trim();

    h.nombre = nombreNuevo;

    // Update en Cascada en aldia_clientes
    clientes.forEach(c => {
        if (c.ref === nombreAntiguo || (c.ref && c.ref.trim() === nombreAntiguo.trim())) {
            c.ref = nombreNuevo;
        }
    });

    // Guarda aldia_clientes, aldia_habitaciones y aldia_servicios en localStorage
    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
    localStorage.setItem('aldia_habitaciones', JSON.stringify(habitaciones));
    localStorage.setItem('aldia_servicios', JSON.stringify(servicios));

    renderizarGestorInventario();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
    if (typeof renderizarDashboard === 'function') renderizarDashboard();
}
window.editarHabitacionGestor = editarHabitacionGestor;

function eliminarServicioGestor(id) {
    let servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
    const s = servicios.find(item => String(item.id) === String(id));
    if (!s) return;

    const clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    const enUso = clientes.some(c => c.activo === true && (c.ref === s.nombre || (c.ref && s.nombre && c.ref.trim() === s.nombre.trim()) || String(c.ref) === String(s.id)));

    if (enUso) {
        alert("No puedes eliminar esto porque hay clientes activos usándolo.");
        return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar el servicio "${s.nombre}"?`)) return;

    if (typeof guardarSnapshot === 'function') guardarSnapshot();
    servicios = servicios.filter(item => String(item.id) !== String(id));
    localStorage.setItem('aldia_servicios', JSON.stringify(servicios));

    renderizarGestorInventario();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
}
window.eliminarServicioGestor = eliminarServicioGestor;

function editarServicioGestor(id) {
    let habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
    let servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];

    const s = servicios.find(item => String(item.id) === String(id));
    if (!s) return;

    const nuevoNombre = prompt("Ingresa el nuevo nombre:", s.nombre);
    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim() === s.nombre) return;

    if (typeof guardarSnapshot === 'function') guardarSnapshot();
    const nombreAntiguo = s.nombre;
    const nombreNuevo = nuevoNombre.trim();

    s.nombre = nombreNuevo;

    // Update en Cascada en aldia_clientes
    clientes.forEach(c => {
        if (c.ref === nombreAntiguo || (c.ref && c.ref.trim() === nombreAntiguo.trim())) {
            c.ref = nombreNuevo;
        }
    });

    // Guarda aldia_clientes, aldia_habitaciones y aldia_servicios en localStorage
    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
    localStorage.setItem('aldia_habitaciones', JSON.stringify(habitaciones));
    localStorage.setItem('aldia_servicios', JSON.stringify(servicios));

    renderizarGestorInventario();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
    if (typeof renderizarDashboard === 'function') renderizarDashboard();
}
window.editarServicioGestor = editarServicioGestor;

function eliminarCategoriaGestor(catNombre) {
    const clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    const enUso = clientes.some(c => c.activo === true && c.tipo_servicio && c.tipo_servicio.toLowerCase() === catNombre.toLowerCase());

    if (enUso) {
        alert("No puedes eliminar esto porque hay clientes activos usándolo.");
        return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar la categoría "${catNombre}"?`)) return;

    if (typeof guardarSnapshot === 'function') guardarSnapshot();
    let servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
    servicios = servicios.filter(s => {
        const cat = s.tipo || s.tipo_servicio;
        return !cat || cat.toLowerCase() !== catNombre.toLowerCase();
    });
    localStorage.setItem('aldia_servicios', JSON.stringify(servicios));

    renderizarGestorInventario();
    if (typeof cargarCategoriasPrincipales === 'function') cargarCategoriasPrincipales();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
}
window.eliminarCategoriaGestor = eliminarCategoriaGestor;

function editarCategoriaGestor(catNombre) {
    let habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
    let servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];

    const nuevoNombre = prompt("Ingresa el nuevo nombre:", catNombre);
    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim().toLowerCase() === catNombre.toLowerCase()) return;

    if (typeof guardarSnapshot === 'function') guardarSnapshot();
    const categoriaAntigua = catNombre;
    const categoriaNueva = nuevoNombre.trim();

    // 2. Recorre aldia_servicios. Si tipo_servicio === categoria_antigua, actualízalo a categoria_nueva
    servicios.forEach(s => {
        if (s.tipo && s.tipo.toLowerCase() === categoriaAntigua.toLowerCase()) {
            s.tipo = categoriaNueva;
        }
        if (s.tipo_servicio && s.tipo_servicio.toLowerCase() === categoriaAntigua.toLowerCase()) {
            s.tipo_servicio = categoriaNueva;
        }
    });

    // 3. Update en Cascada: Recorre aldia_clientes. Si tipo_servicio === categoria_antigua, actualízalo a categoria_nueva
    clientes.forEach(c => {
        if (c.tipo_servicio && c.tipo_servicio.toLowerCase() === categoriaAntigua.toLowerCase()) {
            c.tipo_servicio = categoriaNueva;
        }
    });

    // Guarda aldia_clientes, aldia_habitaciones y aldia_servicios en localStorage
    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
    localStorage.setItem('aldia_habitaciones', JSON.stringify(habitaciones));
    localStorage.setItem('aldia_servicios', JSON.stringify(servicios));

    renderizarGestorInventario();
    if (typeof cargarCategoriasPrincipales === 'function') cargarCategoriasPrincipales();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
    if (typeof renderizarDashboard === 'function') renderizarDashboard();
}
window.editarCategoriaGestor = editarCategoriaGestor;

// ==========================================
// --- MOTOR DE TRASLADO DE INQUILINOS (Fase 5.3) ---
// ==========================================
let modalTrasladoInstancia = null;

function abrirModalTraslado(clienteId, clienteNombre, habitacionActual) {
    const infoEl = document.getElementById('textoTrasladoInfo');
    const idInput = document.getElementById('trasladoClienteId');
    const selectHab = document.getElementById('selectNuevaHabitacion');
    const btnConfirmar = document.getElementById('btnConfirmarTraslado');

    if (infoEl) {
        infoEl.innerHTML = `Mover a <strong>${clienteNombre}</strong> del cuarto <strong>${habitacionActual}</strong> a:`;
    }
    if (idInput) {
        idInput.value = clienteId;
    }

    const habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
    const clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];

    // Filtro inteligente: habitaciones que no tienen ningún inquilino activo
    const habitacionesLibres = habitaciones.filter(h => {
        const ocupada = clientes.some(c => c.activo === true && (c.ref === h.nombre || (c.ref && h.nombre && c.ref.trim() === h.nombre.trim()) || String(c.ref) === String(h.id)));
        return !ocupada;
    });

    if (selectHab) {
        if (habitacionesLibres.length === 0) {
            selectHab.innerHTML = '<option value="" disabled selected>No hay habitaciones libres</option>';
            if (btnConfirmar) btnConfirmar.disabled = true;
        } else {
            selectHab.innerHTML = habitacionesLibres.map(h => `<option value="${h.nombre}">${h.nombre} (S/ ${parseFloat(h.precio_base || 0).toFixed(2)})` + (h.frecuencia_base ? ` - ${h.frecuencia_base}` : '') + `</option>`).join('');
            if (btnConfirmar) btnConfirmar.disabled = false;
        }
    }

    const modalEl = document.getElementById('modalTrasladoInquilino');
    if (modalEl) {
        if (!modalTrasladoInstancia) {
            modalTrasladoInstancia = new bootstrap.Modal(modalEl);
        }
        modalTrasladoInstancia.show();
    }
}
window.abrirModalTraslado = abrirModalTraslado;

function confirmarTraslado() {
    const idInput = document.getElementById('trasladoClienteId');
    const selectHab = document.getElementById('selectNuevaHabitacion');

    if (!idInput || !selectHab) return;
    const clienteId = idInput.value;
    const nuevaHabitacion = selectHab.value;

    if (!clienteId || !nuevaHabitacion) {
        alert("Selecciona una habitación válida para el traslado.");
        return;
    }

    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    const cliente = clientes.find(c => String(c.id) === String(clienteId));

    if (!cliente) {
        alert("Cliente no encontrado.");
        return;
    }

    if (typeof guardarSnapshot === 'function') guardarSnapshot();

    cliente.ref = nuevaHabitacion;
    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));

    const modalEl = document.getElementById('modalTrasladoInquilino');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || modalTrasladoInstancia;
        if (modalInstance) modalInstance.hide();
    }

    renderizarGestorInventario();
    if (typeof cargarOpcionesInventario === 'function') cargarOpcionesInventario();
    if (typeof renderizarDashboard === 'function') renderizarDashboard();
}
window.confirmarTraslado = confirmarTraslado;

// ==========================================
// --- MOTOR DE EXPORTACIÓN A PDF Y EXCEL (Fase 5.4 - Estructurada y Dinámica) ---
// ==========================================
function exportarReporte(formato) {
    if (formato === 'excel' && typeof XLSX === 'undefined') {
        alert("La librería de Excel no está disponible. Por favor recarga la aplicación.");
        return;
    }
    if (formato === 'pdf' && (!window.jspdf || !window.jspdf.jsPDF)) {
        alert("La librería de PDF no está disponible. Por favor recarga la aplicación.");
        return;
    }

    const inputMes = document.getElementById('filtroMesHistorial');
    let anioFiltro, mesFiltro;
    if (inputMes && inputMes.value) {
        const partes = inputMes.value.split('-').map(Number);
        anioFiltro = partes[0];
        mesFiltro = partes[1];
    } else {
        const hoy = new Date();
        anioFiltro = hoy.getFullYear();
        mesFiltro = hoy.getMonth() + 1;
    }

    const tipoFiltro = obtenerTipoFiltroHistorial();

    const nombreMesTexto = (typeof meses !== 'undefined' && meses[mesFiltro - 1]) ? meses[mesFiltro - 1] : String(mesFiltro).padStart(2, '0');

    let sufijo = "";
    if (tipoFiltro === 'ingresos') sufijo = "_Ingresos";
    else if (tipoFiltro === 'egresos') sufijo = "_Egresos";

    const nombreArchivoBase = "Reporte_ALDIA_" + nombreMesTexto + "_" + anioFiltro + sufijo;

    const pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    const egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
    const clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];

    const datosIngresos = [];
    const datosEgresos = [];

    // 1. Filtrar y procesar Ingresos
    if (tipoFiltro === 'ambos' || tipoFiltro === 'ingresos') {
        pagos.filter(p => {
            if (!p.pagado) return false;
            let pAnio = Number(p.año || p.ano);
            let pMes = Number(p.mes);
            if ((!pAnio || !pMes) && p.fecha_pago_real) {
                let f = new Date(Number(p.fecha_pago_real));
                if (!isNaN(f.getTime())) {
                    pAnio = f.getFullYear();
                    pMes = f.getMonth() + 1;
                }
            }
            return pAnio === anioFiltro && pMes === mesFiltro;
        }).forEach(pago => {
            const cliente = clientes.find(c => c.id === pago.cliente_id);

            // Regla dinámica de "Concepto":
            // - Si pago.es_garantia es true -> "Garantía"
            // - Si pago.metodo es "Liquidación Final" -> "Liquidación Final"
            // - De lo contrario, según frecuencia: Mensual -> Mensualidad, Quincenal -> Quincena, Semanal -> Semana, Diario -> Día (Fallback: Servicio)
            let concepto = 'Servicio';
            if (pago.es_garantia === true || pago.es_garantia === 'true') {
                concepto = 'Garantía';
            } else if (pago.metodo && pago.metodo.toString().trim().toLowerCase() === 'liquidación final') {
                concepto = 'Liquidación Final';
            } else if (cliente && cliente.frecuencia) {
                const f = cliente.frecuencia.toString().trim().toLowerCase();
                if (f === 'mensual') concepto = 'Mensualidad';
                else if (f === 'quincenal') concepto = 'Quincena';
                else if (f === 'semanal') concepto = 'Semana';
                else if (f === 'diario') concepto = 'Día';
                else concepto = 'Servicio';
            } else {
                concepto = 'Servicio';
            }

            const timestampBase = pago.fecha_pago_real ? pago.fecha_pago_real : pago.id;
            const fechaFormateada = formatearFechaCorta(timestampBase);

            const cuarto = (cliente && cliente.ref) ? cliente.ref : '-';
            const inquilino = (cliente && cliente.nombre) ? cliente.nombre : 'Cliente General';
            const monto = parseFloat(pago.monto) || 0;
            const metodo = pago.metodo || 'Efectivo';

            datosIngresos.push({
                timestamp: Number(timestampBase) || 0,
                fecha: fechaFormateada,
                cuarto: cuarto,
                inquilino: inquilino,
                concepto: concepto,
                metodo: metodo,
                monto: monto
            });
        });
    }

    // 2. Filtrar y procesar Egresos
    if (tipoFiltro === 'ambos' || tipoFiltro === 'egresos') {
        egresos.forEach(egr => {
            let d, m, y;
            if (egr.fecha && typeof egr.fecha === 'string' && egr.fecha.includes('-')) {
                const partes = egr.fecha.split('-');
                y = Number(partes[0]);
                m = Number(partes[1]);
                d = String(partes[2]).padStart(2, '0');
            } else {
                d = String(egr.dia || '01').padStart(2, '0');
                m = Number(egr.mes || mesFiltro);
                y = Number(egr.año || anioFiltro);
            }

            if (y === anioFiltro && m === mesFiltro) {
                const fechaFormateada = `${d}/${String(m).padStart(2, '0')}/${y}`;

                let timestampEgreso = Number(egr.id);
                if (egr.fecha) {
                    const partesFecha = egr.fecha.split('-').map(Number);
                    if (partesFecha.length === 3) {
                        const fechaBaseId = new Date(Number(egr.id));
                        const hrsB = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getHours() : 0;
                        const minsB = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getMinutes() : 0;
                        const secsB = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getSeconds() : 0;
                        timestampEgreso = new Date(partesFecha[0], partesFecha[1] - 1, partesFecha[2], hrsB, minsB, secsB).getTime();
                    }
                }

                datosEgresos.push({
                    timestamp: timestampEgreso || 0,
                    fecha: fechaFormateada,
                    categoria: egr.categoria || 'Gasto / Egreso',
                    motivo: egr.motivo || 'Egreso',
                    monto: parseFloat(egr.monto) || 0
                });
            }
        });
    }

    // Ordenar cronológicamente
    datosIngresos.sort((a, b) => a.timestamp - b.timestamp);
    datosEgresos.sort((a, b) => a.timestamp - b.timestamp);

    const totalIngresos = datosIngresos.reduce((sum, item) => sum + item.monto, 0);
    const totalEgresos = datosEgresos.reduce((sum, item) => sum + item.monto, 0);
    const neto = totalIngresos - totalEgresos;

    // EXCEL: Estructura Jerárquica (Resumen > Ingresos > Egresos)
    if (formato === 'excel') {
        let filaResumenExcel = [];
        if (tipoFiltro === 'ingresos') {
            filaResumenExcel = ['TOTAL INGRESOS:', Number(totalIngresos.toFixed(2))];
        } else if (tipoFiltro === 'egresos') {
            filaResumenExcel = ['TOTAL EGRESOS:', Number(totalEgresos.toFixed(2))];
        } else {
            filaResumenExcel = ['TOTAL INGRESOS:', Number(totalIngresos.toFixed(2)), 'TOTAL EGRESOS:', Number(totalEgresos.toFixed(2)), 'NETO:', Number(neto.toFixed(2))];
        }

        const aoa = [
            ['RESUMEN FINANCIERO'],
            [`Periodo: ${nombreMesTexto} ${anioFiltro}`, `Filtro: ${tipoFiltro.toUpperCase()}`],
            filaResumenExcel,
            [] // Fila vacía
        ];

        // Bloque Ingresos (si aplica)
        if (tipoFiltro === 'ambos' || tipoFiltro === 'ingresos') {
            aoa.push(['DETALLE DE INGRESOS']);
            aoa.push(['Fecha', 'Cuarto', 'Inquilino', 'Concepto', 'Método', 'Monto']);
            if (datosIngresos.length > 0) {
                datosIngresos.forEach(item => {
                    aoa.push([item.fecha, item.cuarto, item.inquilino, item.concepto, item.metodo, Number(item.monto.toFixed(2))]);
                });
                aoa.push(['Subtotal Ingresos:', '', '', '', '', Number(totalIngresos.toFixed(2))]);
            } else {
                aoa.push(['No se registraron ingresos en este periodo']);
            }
            aoa.push([]); // Fila vacía
        }

        // Bloque Egresos (si aplica)
        if (tipoFiltro === 'ambos' || tipoFiltro === 'egresos') {
            aoa.push(['DETALLE DE EGRESOS']);
            aoa.push(['Fecha', 'Categoría', 'Motivo', 'Monto']);
            if (datosEgresos.length > 0) {
                datosEgresos.forEach(item => {
                    aoa.push([item.fecha, item.categoria, item.motivo, Number(item.monto.toFixed(2))]);
                });
                aoa.push(['Subtotal Egresos:', '', '', Number(totalEgresos.toFixed(2))]);
            } else {
                aoa.push(['No se registraron egresos en este periodo']);
            }
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        XLSX.writeFile(wb, nombreArchivoBase + ".xlsx");

    // PDF: Estructura Jerárquica con jsPDF + autoTable
    } else if (formato === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        // Bloque 1 (Resumen): Título
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(33, 37, 41);
        doc.text(`Reporte Financiero - ${nombreMesTexto} ${anioFiltro}`, 14, 18);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(108, 117, 125);
        doc.text(`Filtro: ${tipoFiltro.toUpperCase()} | Fecha de emisión: ${formatearFechaHora(Date.now())}`, 14, 25);

        // Tarjetas individuales de Resumen (Burbujas)
        const margin = 14;
        const gap = 5;
        const usableWidth = pageWidth - (margin * 2);
        const boxHeight = 12;
        const boxY = 29;
        const textY = boxY + 7.5;

        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setDrawColor(210, 215, 220);

        if (tipoFiltro === 'ambos') {
            const boxWidth = (usableWidth - (gap * 2)) / 3;

            // Burbuja 1 (Ingresos)
            const x1 = margin;
            doc.roundedRect(x1, boxY, boxWidth, boxHeight, 2, 2, 'S');
            doc.setTextColor(25, 135, 84);
            doc.text(`TOTAL INGRESOS: S/ ${totalIngresos.toFixed(2)}`, x1 + (boxWidth / 2), textY, { align: "center" });

            // Burbuja 2 (Egresos)
            const x2 = margin + boxWidth + gap;
            doc.roundedRect(x2, boxY, boxWidth, boxHeight, 2, 2, 'S');
            doc.setTextColor(220, 53, 69);
            doc.text(`TOTAL EGRESOS: S/ ${totalEgresos.toFixed(2)}`, x2 + (boxWidth / 2), textY, { align: "center" });

            // Burbuja 3 (Neto)
            const x3 = margin + (boxWidth * 2) + (gap * 2);
            doc.roundedRect(x3, boxY, boxWidth, boxHeight, 2, 2, 'S');
            doc.setTextColor(neto >= 0 ? 13 : 220, neto >= 0 ? 110 : 53, neto >= 0 ? 253 : 69);
            doc.text(`NETO: S/ ${neto.toFixed(2)}`, x3 + (boxWidth / 2), textY, { align: "center" });

        } else if (tipoFiltro === 'ingresos' || tipoFiltro === 'egresos') {
            const boxWidth = usableWidth / 2;
            const x = (pageWidth / 2) - (boxWidth / 2);

            doc.roundedRect(x, boxY, boxWidth, boxHeight, 2, 2, 'S');
            if (tipoFiltro === 'ingresos') {
                doc.setTextColor(25, 135, 84);
                doc.text(`TOTAL INGRESOS: S/ ${totalIngresos.toFixed(2)}`, pageWidth / 2, textY, { align: "center" });
            } else {
                doc.setTextColor(220, 53, 69);
                doc.text(`TOTAL EGRESOS: S/ ${totalEgresos.toFixed(2)}`, pageWidth / 2, textY, { align: "center" });
            }
        }

        let currentY = boxY + boxHeight + 8;

        // Bloque 2 (Ingresos)
        if (tipoFiltro === 'ambos' || tipoFiltro === 'ingresos') {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text("Detalle de Ingresos", 14, currentY);

            const filasIngresos = datosIngresos.map(item => [
                item.fecha,
                item.cuarto,
                item.inquilino,
                item.concepto,
                item.metodo,
                `S/ ${item.monto.toFixed(2)}`
            ]);

            doc.autoTable({
                startY: currentY + 4,
                head: [['Fecha', 'Cuarto', 'Inquilino', 'Concepto', 'Método', 'Monto']],
                body: filasIngresos.length > 0 ? filasIngresos : [['-', '-', 'No se registraron ingresos', '-', '-', 'S/ 0.00']],
                theme: 'striped',
                headStyles: { fillColor: [40, 167, 69] },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    5: { halign: 'right' }
                }
            });

            currentY = doc.lastAutoTable.finalY + 12;
        }

        // Bloque 3 (Egresos)
        if (tipoFiltro === 'ambos' || tipoFiltro === 'egresos') {
            if (currentY > 230) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text("Detalle de Egresos", 14, currentY);

            const filasEgresos = datosEgresos.map(item => [
                item.fecha,
                item.categoria,
                item.motivo,
                `S/ ${item.monto.toFixed(2)}`
            ]);

            doc.autoTable({
                startY: currentY + 4,
                head: [['Fecha', 'Categoría', 'Motivo', 'Monto']],
                body: filasEgresos.length > 0 ? filasEgresos : [['-', '-', 'No se registraron egresos', 'S/ 0.00']],
                theme: 'striped',
                headStyles: { fillColor: [220, 53, 69] },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    3: { halign: 'right' }
                }
            });
        }

        doc.save(nombreArchivoBase + ".pdf");
    }
}
window.exportarReporte = exportarReporte;