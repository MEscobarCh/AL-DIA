// Configuración de Fechas
const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const hoy = new Date();
const mesActual = hoy.getMonth() + 1; // 1-12
const añoActual = hoy.getFullYear();

// Inicialización de la App
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('mes-actual-display').innerHTML = `<i class="fas fa-calendar-alt me-2"></i> ${meses[mesActual - 1]} ${añoActual}`;
    iniciarBaseDeDatos();
    generarDeudasDelMes();
    renderizarDashboard();
    
    // Inicializar módulo unificado de registro dinámico (Fase 2)
    iniciarModuloRegistro();
});

// --- BASE DE DATOS LOCAL ---
function iniciarBaseDeDatos() {
    if (!localStorage.getItem('aldia_clientes')) {
        // Cargar datos de prueba
        const clientesPrueba = [
            { id: 1, nombre: "Juan", apellido: "García", monto: 350.00, dia: 28, activo: true, ref: "Cuarto 301" }
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

                htmlPagados += `
                <div class="card-custom p-3 shadow-sm border-start border-4 border-success mb-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1 fw-bold text-dark d-flex align-items-center gap-2">
                                ${cliente.nombre}
                                ${badgeHtml}
                            </h6>
                            <small class="text-muted"><i class="fas fa-wallet me-1"></i> ${pago.metodo || 'Efectivo'}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="fw-bold text-success fs-5 me-2">S/ ${parseFloat(pago.monto).toFixed(2)}</span>
                            ${botonExtraHtml}
                            <button class="btn btn-sm btn-outline-secondary rounded-circle shadow-sm" style="width: 35px; height: 35px; padding: 0;" onclick="revertirPago(${pago.id}, '${cliente.nombre}')" title="Revertir cobro"><i class="fas fa-undo-alt"></i></button>
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
            htmlPagados += `
            <div class="card-custom p-3 shadow-sm border-start border-4 border-success mb-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1 fw-bold text-dark d-flex align-items-center gap-2">
                            ${cliente.nombre} 
                            <span class="badge bg-success text-white rounded-pill px-2 py-1" style="font-size: 0.65rem;"><i class="fas fa-shield-alt me-1"></i>Garantía</span>
                        </h6>
                        <small class="text-muted"><i class="fas fa-wallet me-1"></i> ${pagoGarantia.metodo}</small>
                    </div>
                    <div class="d-flex align-items-center gap-3">
                        <span class="fw-bold text-success fs-5">S/ ${parseFloat(pagoGarantia.monto).toFixed(2)}</span>
                        <button class="btn btn-sm btn-outline-secondary rounded-circle shadow-sm" style="width: 35px; height: 35px; padding: 0;" onclick="revertirPago(${pagoGarantia.id}, '${cliente.nombre} (Garantía)')" title="Revertir cobro"><i class="fas fa-undo-alt"></i></button>
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

    // Ordenar deudas pendientes de forma totalmente independiente:
    // Mayor atraso primero, y fechas futuras al final por más próximo a vencer
    let hoyCero = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate());
    listaPendientes.sort((a, b) => {
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
        return atrasoB - atrasoA;
    });

    // Renderizado independiente de cuotas y garantías
    listaPendientes.forEach(item => {
        let cliente = item.cliente;

        if (item.tipo === 'cuota') {
            let badgeHtml = "";
            let botonExtraHtml = "";

            if (cliente.tipo_servicio === 'streaming') {
                badgeHtml = `<span class="badge bg-dark text-white rounded-pill px-2 py-1" style="font-size: 0.7rem;"><i class="fas fa-tv me-1"></i>${cliente.ref || 'Streaming'}</span>`;
                botonExtraHtml = `<button class="btn btn-info rounded-circle shadow-sm text-white me-2" style="width: 35px; height: 35px; padding: 0;" onclick="sumarDiasStreaming(${cliente.id}, '${cliente.nombre}')" title="Añadir días extra"><i class="fas fa-hourglass-half"></i></button>`;
            } else {
                badgeHtml = `<span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1" style="font-size: 0.7rem;"><i class="fas fa-home me-1"></i>${cliente.ref || 'Sin ref'}</span>`;
            }

            let pago = item.pagoPendiente || pagos.find(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && !p.es_garantia && !p.pagado);
            let montoDeuda = pago ? pago.monto : cliente.monto;
            saldoPendiente += parseFloat(montoDeuda);

            let diaCobro = cliente.dia;
            let textoFecha = `Cuota del ${diaCobro} de ${meses[mesVisualizado - 1]}`;
            let textoDias = "";
            let claseColor = "text-muted"; 
            let botonCobroHtml = "";
            let alertaMora = "";

            // ALERTA: ¿Arrastra deudas anteriores?
            let deudasPasadas = pagos.filter(p => p.cliente_id === cliente.id && p.pagado === false && !p.es_garantia && (p.año < añoVisualizado || (p.año === añoVisualizado && p.mes < mesVisualizado)));
            if (deudasPasadas.length > 0) {
                alertaMora = `<span class="d-block text-danger fw-bold mt-1" style="font-size: 0.75rem;"><i class="fas fa-exclamation-triangle"></i> Arrastra ${deudasPasadas.length} mes(es) sin pagar</span>`;
            }

            // LÓGICA DE TIEMPOS
            if (esMesFuturo) {
                textoDias = `, Proxima Cuota`;
                claseColor = "text-primary fw-bold";
                botonCobroHtml = `<i class="fas fa-lock text-muted opacity-50 fs-4" title="Mes bloqueado"></i>`;
            } else {
                if (esMesPasado) {
                    textoDias = `, ¡Atrasado!`;
                    claseColor = "text-danger fw-bold";
                } else if (diaCobro > diaHoy) {
                    let faltan = diaCobro - diaHoy;
                    textoDias = `, faltan ${faltan} día${faltan > 1 ? 's' : ''}`;
                } else if (diaCobro === diaHoy) {
                    textoDias = `, ¡Vence hoy!`;
                    claseColor = "text-warning fw-bold";
                } else {
                    let atraso = diaHoy - diaCobro;
                    textoDias = `, atrasado por ${atraso} día${atraso > 1 ? 's' : ''}`;
                    claseColor = "text-danger fw-bold";
                }
                
                if (pago) {
                    botonCobroHtml = `<button class="btn btn-success rounded-circle shadow-sm" style="width: 40px; height: 40px;" onclick="abrirModal(${pago.id}, '${cliente.nombre}', ${montoDeuda})"><i class="fas fa-check"></i></button>`;
                }
            }

            // --- SECCIÓN: PENDIENTES (Con el lápiz de edición inyectado aquí) ---
            htmlPendientes += `
            <div class="card-custom p-3 shadow-sm border-start border-4 border-warning mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <!-- Lado Izquierdo: Flexible (flex-grow-1 y min-width: 0 para que no empuje) -->
                    <div class="flex-grow-1" style="min-width: 0; padding-right: 10px;">
                        <h6 class="mb-1 fw-bold text-dark d-flex align-items-center flex-wrap gap-2">
                            <span class="text-truncate" style="max-width: 100%;">${cliente.nombre}</span> 
                            ${badgeHtml}
                            <div class="d-inline-flex flex-nowrap">
                                <button class="btn btn-sm btn-link text-primary p-0" onclick="abrirModalEditarCliente(${cliente.id})" title="Editar"><i class="fas fa-edit fs-5"></i></button>
                                <button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="eliminarCliente(${cliente.id}, '${cliente.nombre}')" title="Dar de baja"><i class="fas fa-times-circle fs-5"></i></button>
                            </div>
                        </h6>
                        <small class="${claseColor} d-block text-wrap" style="font-size: 0.75rem;">${textoFecha}${textoDias}</small>
                        ${alertaMora}
                    </div>
                    
                    <!-- Lado Derecho: Intocable (flex-shrink-0 para que NUNCA se encoja) -->
                    <div class="d-flex align-items-center gap-2 flex-shrink-0">
                        <span class="fw-bold text-dark fs-5">S/ ${parseFloat(montoDeuda).toFixed(2)}</span>
                        ${botonExtraHtml}
                        ${botonCobroHtml}
                    </div>
                </div>
            </div>`;
        } else if (item.tipo === 'garantia') {
            let [anioGar, mesGar, diaGar] = cliente.garantia_fecha.split('-').map(Number);
            saldoPendiente += parseFloat(cliente.garantia_monto);
            
            let textoFechaGar = `Garantía para el ${diaGar} de ${meses[mesGar - 1]}`;
            let claseColorGar = "text-muted";
            let botonCobroGar = "";
            
            if (añoVisualizado === anioGar && mesVisualizado === mesGar) {
                if (diaGar > diaHoy && esMesActualReal) {
                    let faltan = diaGar - diaHoy;
                    textoFechaGar += `, faltan ${faltan} días`;
                } else if (diaGar === diaHoy && esMesActualReal) {
                    textoFechaGar += `, ¡Vence hoy!`;
                    claseColorGar = "text-warning fw-bold";
                } else if (diaGar < diaHoy && esMesActualReal) {
                    let atraso = diaHoy - diaGar;
                    textoFechaGar += `, atrasada por ${atraso} días`;
                    claseColorGar = "text-danger fw-bold";
                }
            } else {
                textoFechaGar += `, ¡Atrasada!`;
                claseColorGar = "text-danger fw-bold";
            }
            
            if (!esMesFuturo) {
                botonCobroGar = `<button class="btn btn-primary rounded-circle shadow-sm" style="width: 40px; height: 40px;" onclick="abrirModalGarantia(${cliente.id}, '${cliente.nombre}', ${cliente.garantia_monto})"><i class="fas fa-shield-alt"></i></button>`;
            } else {
                botonCobroGar = `<i class="fas fa-lock text-muted opacity-50 fs-4"></i>`;
            }

            htmlPendientes += `
            <div class="card-custom p-3 shadow-sm border-start border-4 border-primary mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1 fw-bold text-dark d-flex align-items-center gap-2">
                            ${cliente.nombre} 
                            <span class="badge bg-primary text-white rounded-pill px-2 py-1" style="font-size: 0.65rem;"><i class="fas fa-shield-alt me-1"></i>Garantía</span>
                        </h6>
                        <small class="${claseColorGar} d-block" style="font-size: 0.75rem;">${textoFechaGar}</small>
                    </div>
                    <div class="d-flex align-items-center gap-3">
                        <span class="fw-bold text-dark fs-5">S/ ${parseFloat(cliente.garantia_monto).toFixed(2)}</span>
                        ${botonCobroGar}
                    </div>
                </div>
            </div>`;
        }
    });

    // 2. PROCESAR EGRESOS DEL MES VISUALIZADO
    let egresosDelMes = egresos.filter(e => e.mes === mesVisualizado && e.año === añoVisualizado);
    egresosDelMes.forEach(egreso => {
        totalEgresos += parseFloat(egreso.monto);
        htmlEgresos += `
        <div class="card-custom p-3 shadow-sm border-start border-4 border-danger mb-2">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1 fw-bold text-dark">${egreso.motivo}</h6>
                    <small class="text-muted"><i class="far fa-calendar-alt me-1"></i> Día ${egreso.dia}</small>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <span class="fw-bold text-danger fs-5">- S/ ${parseFloat(egreso.monto).toFixed(2)}</span>
                    <button class="btn btn-sm btn-outline-danger rounded-circle shadow-sm" style="width: 35px; height: 35px; padding: 0;" onclick="eliminarEgreso(${egreso.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });

    // 3. ACTUALIZAR INTERFAZ
    document.getElementById('total-ingresos').innerText = `S/ ${totalIngresos.toFixed(2)}`;
    document.getElementById('total-egresos').innerText = `S/ ${totalEgresos.toFixed(2)}`;
    
    // Calcular el Saldo Global Acumulado (Todos los meses históricos)
    let ingresosGlobales = pagos.filter(p => p.pagado).reduce((sum, p) => sum + parseFloat(p.monto), 0);
    let egresosGlobales = egresos.reduce((sum, e) => sum + parseFloat(e.monto), 0);
    let saldoGlobalAcumulado = ingresosGlobales - egresosGlobales;
    
    document.getElementById('saldo-mes').innerText = `S/ ${saldoGlobalAcumulado.toFixed(2)}`;
    document.getElementById('saldo-pendiente').innerText = `S/ ${saldoPendiente.toFixed(2)}`;

    if (htmlPendientes === "") htmlPendientes = '<div class="text-center text-white my-3 fw-bold"><p>¡Todos al día!</p></div>';
    if (htmlPagados === "") htmlPagados = '<div class="text-center text-white-50 my-3"><small>Aún no hay ingresos este mes.</small></div>';
    if (htmlEgresos === "") htmlEgresos = '<div class="text-center text-white-50 my-3"><small>No hay egresos registrados.</small></div>';

    document.getElementById('lista-pendientes').innerHTML = htmlPendientes;
    document.getElementById('lista-pagados').innerHTML = htmlPagados;
    document.getElementById('lista-egresos').innerHTML = htmlEgresos;
    document.getElementById('mes-actual-display').innerText = `${meses[mesVisualizado - 1]} ${añoVisualizado}`;
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

function procesarPago() {
    let pagoIdVal = document.getElementById('pago-id-actual').value;
    let metodo = document.querySelector('input[name="metodo_pago"]:checked').value;
    
    // Si el valor empieza con GARANTIA_
    if (String(pagoIdVal).startsWith("GARANTIA_")) {
        let cliId = parseInt(pagoIdVal.split("_")[1]);
        let clientes = JSON.parse(localStorage.getItem('aldia_clientes'));
        let cliente = clientes.find(c => c.id === cliId);
        
        if (cliente) {
            cliente.garantia_pagada = true; // Actualizamos su perfil
            localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
            
            let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
            pagos.push({
                id: Date.now(),
                fecha_pago_real: Date.now(),
                cliente_id: cliente.id,
                mes: mesActual,
                año: añoActual,
                monto: cliente.garantia_monto,
                pagado: true,
                metodo: metodo,
                historico: `${cliente.nombre} (Garantía)`.trim(),
                es_garantia: true
            });
            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
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
            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
        }
    }
    
    modalInstancia.hide();
    renderizarDashboard();
}

// --- NUEVA FUNCIÓN: REVERTIR COBRO ---
function revertirPago(pagoId, nombre) {
    if (confirm(`⚠️ ¿Seguro que deseas REVERTIR el cobro de ${nombre}?`)) {
        guardarSnapshot();
        let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
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
            }

            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));

            mostrarToastDeshacer(`Cobro de ${nombre} revertido.`);
            renderizarDashboard();
            renderizarEstadisticas();
        }
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
        monto: parseFloat(document.getElementById('cli-monto').value),
        fecha_inicio: fechaInput,
        dia: parseInt(partes[2]),
        ref: document.getElementById('cli-ref').value,
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
            es_garantia: true
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

            pagos.push({
                id: Date.now() + i,
                fecha_pago_real: Date.now(),
                cliente_id: nCli.id,
                mes: mesCobro,
                año: añoCobro,
                monto: nCli.monto,
                pagado: true,
                metodo: metodoSeleccionado,
                historico: `${nCli.nombre} ${nCli.apellido}`.trim()
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
function renderizarEstadisticas() {
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || []; 

    let historialAgrupado = {};

    // 1. Agrupar Ingresos (Solo pagados)
    pagos.filter(p => p.pagado).forEach(pago => {
        let key = `${pago.año}-${String(pago.mes).padStart(2, '0')}`;
        if (!historialAgrupado[key]) historialAgrupado[key] = { mes: pago.mes, año: pago.año, ingresos: [], egresos: [] };
        
        // Buscar los detalles extra del cliente
        let cliente = clientes.find(c => c.id === pago.cliente_id);
        let tipoServicio = (cliente && cliente.tipo_servicio === 'streaming') ? 'streaming' : 'cuarto';
        let icono = tipoServicio === 'streaming' ? '<i class="fas fa-tv"></i>' : '<i class="fas fa-home"></i>';
        let referencia = (cliente && cliente.ref) ? cliente.ref : (tipoServicio === 'streaming' ? 'Streaming' : 'Cuarto');
        
        let colorBadge = tipoServicio === 'streaming' ? 'bg-dark text-white' : 'bg-primary bg-opacity-10 text-primary';
        let badgeHtml = `<span class="badge ${colorBadge} rounded-pill ms-2" style="font-size: 0.65rem;">${icono} ${referencia}</span>`;

        // Extraer la Fecha y Hora exactas para TODOS los ingresos (prioridad a fecha_pago_real)
        const timestampBase = pago.fecha_pago_real ? pago.fecha_pago_real : pago.id;
        const fechaPago = new Date(Number(timestampBase));
        let d = fechaPago.getDate().toString().padStart(2, '0');
        let m = (fechaPago.getMonth() + 1).toString().padStart(2, '0');
        let y = fechaPago.getFullYear();
        let hrs = fechaPago.getHours().toString().padStart(2, '0');
        let mins = fechaPago.getMinutes().toString().padStart(2, '0');
        let fechaStr = `${d}/${m}/${y} a las ${hrs}:${mins}`;

        historialAgrupado[key].ingresos.push({ 
            id: pago.id, 
            tipo: 'ingreso', 
            desc: pago.historico, 
            badge: badgeHtml,
            monto: pago.monto, 
            metodo: pago.metodo, 
            fechaStr: fechaStr,
            timestampReal: Number(pago.fecha_pago_real || pago.id)
        });
    });

    // 2. Agrupar Egresos (Extracción de fecha y hora unificadas)
    egresos.forEach(egr => {
        let key = `${egr.año}-${String(egr.mes).padStart(2, '0')}`;
        if (!historialAgrupado[key]) historialAgrupado[key] = { mes: egr.mes, año: egr.año, ingresos: [], egresos: [] };
        
        // Día, mes y año leídos de egr.fecha (con fallback a dia, mes, año numéricos)
        let d, m, y;
        if (egr.fecha && typeof egr.fecha === 'string' && egr.fecha.includes('-')) {
            let partes = egr.fecha.split('-');
            y = partes[0];
            m = String(partes[1]).padStart(2, '0');
            d = String(partes[2]).padStart(2, '0');
        } else {
            d = String(egr.dia || '01').padStart(2, '0');
            m = String(egr.mes || '01').padStart(2, '0');
            y = String(egr.año || new Date().getFullYear());
        }

        // Hora y minuto extraídos matemáticamente de new Date(Number(egr.id)) con fallback 00:00
        let hrs = "00";
        let mins = "00";
        const dateId = new Date(Number(egr.id));
        if (egr.id && !isNaN(dateId.getTime()) && Number(egr.id) > 1000000000000) {
            hrs = dateId.getHours().toString().padStart(2, '0');
            mins = dateId.getMinutes().toString().padStart(2, '0');
        }

        let fechaStrEgr = `${d}/${m}/${y} a las ${hrs}:${mins}`;

        let timestampEgreso = Number(egr.id);
        if (egr.fecha) {
            // Extraer año, mes (base 0) y día desde la cadena "AAAA-MM-DD"
            const partesFecha = egr.fecha.split('-').map(Number);
            if (partesFecha.length === 3) {
                const fechaBaseId = new Date(Number(egr.id));
                const hrs = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getHours() : 0;
                const mins = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getMinutes() : 0;
                const secs = !isNaN(fechaBaseId.getTime()) ? fechaBaseId.getSeconds() : 0;
                
                timestampEgreso = new Date(partesFecha[0], partesFecha[1] - 1, partesFecha[2], hrs, mins, secs).getTime();
            }
        }

        historialAgrupado[key].egresos.push({ 
            id: egr.id, 
            tipo: 'egreso', 
            desc: egr.motivo, 
            monto: egr.monto, 
            fechaStr: fechaStrEgr, 
            timestampReal: timestampEgreso 
        });
    });

    let llavesOrdenadas = Object.keys(historialAgrupado).sort((a, b) => b.localeCompare(a));

    let htmlHistorial = "";
    if (llavesOrdenadas.length === 0) {
        htmlHistorial = '<div class="text-center text-white-50 py-4"><p>Aún no hay movimientos en el historial.</p></div>';
    } else {
        llavesOrdenadas.forEach(key => {
            let dataMes = historialAgrupado[key];
            let sumaIngresos = dataMes.ingresos.reduce((sum, item) => sum + parseFloat(item.monto), 0);
            let sumaEgresos = dataMes.egresos.reduce((sum, item) => sum + parseFloat(item.monto), 0);
            let neto = sumaIngresos - sumaEgresos;

            historialAgrupado[key].ingresos.sort((a, b) => b.timestampReal - a.timestampReal);
            historialAgrupado[key].egresos.sort((a, b) => b.timestampReal - a.timestampReal);

            let listaItemsHtml = "";
            
            if (dataMes.ingresos.length > 0) {
                listaItemsHtml += `<div class="text-muted small fw-bold mb-2 mt-1 px-1 text-uppercase">Ingresos Registrados</div>`;
                dataMes.ingresos.forEach(ing => {
                    listaItemsHtml += `
                    <div class="bg-white p-2 mb-2 rounded shadow-sm border-start border-4 border-success d-flex justify-content-between align-items-center">
                        <div style="max-width: 75%;">
                            <div class="d-flex align-items-center mb-1 flex-wrap gap-1">
                                <span class="fw-bold text-dark text-truncate">${ing.desc}</span>
                                ${ing.badge}
                            </div>
                            <small class="text-muted d-block" style="font-size:0.7rem;"><i class="far fa-calendar-check me-1"></i>Pagado el ${ing.fechaStr}</small>
                            <small class="text-muted d-block" style="font-size:0.7rem;"><i class="fas fa-wallet me-1"></i>Ingreso por ${ing.metodo}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="text-success fw-bold small">+ S/ ${parseFloat(ing.monto).toFixed(2)}</span>
                            <button class="btn btn-sm btn-outline-danger" style="width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="eliminarPagoHistorial(${ing.id})" title="Eliminar registro"><i class="fas fa-trash-alt" style="font-size: 0.75rem;"></i></button>
                        </div>
                    </div>`;
                });
            }

            if (dataMes.egresos.length > 0) {
                listaItemsHtml += `<div class="text-muted small fw-bold mb-2 mt-3 px-1 text-uppercase">Egresos Registrados</div>`;
                dataMes.egresos.forEach(egr => {
                    listaItemsHtml += `
                    <div class="bg-white p-2 mb-2 rounded shadow-sm border-start border-4 border-danger d-flex justify-content-between align-items-center">
                        <div style="max-width: 75%;">
                            <span class="fw-bold text-dark d-block mb-1">${egr.desc}</span>
                            <small class="text-muted d-block" style="font-size:0.7rem;"><i class="far fa-calendar-minus me-1"></i>Egreso el ${egr.fechaStr}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="text-danger fw-bold small">- S/ ${parseFloat(egr.monto).toFixed(2)}</span>
                            <button class="btn btn-sm btn-outline-danger" style="width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="eliminarEgresoHistorial(${egr.id})" title="Eliminar registro"><i class="fas fa-trash-alt" style="font-size: 0.75rem;"></i></button>
                        </div>
                    </div>`;
                });
            }

            htmlHistorial += `
            <div class="card-custom p-3 shadow mb-4 border-0">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold text-primary m-0 text-uppercase"><i class="far fa-calendar-alt me-2"></i>${meses[dataMes.mes - 1]} ${dataMes.año}</h6>
                    <span class="badge ${neto >= 0 ? 'bg-success' : 'bg-danger'} py-2 px-3 fs-6 rounded-pill">Neto: S/ ${neto.toFixed(2)}</span>
                </div>
                
                <div class="row text-center mb-3 g-2">
                    <div class="col-6">
                        <div class="bg-success bg-opacity-10 rounded p-2 border border-success border-opacity-25">
                            <small class="text-success d-block fw-bold" style="font-size:0.7rem;">INGRESOS</small>
                            <span class="text-success fw-bold">S/ ${sumaIngresos.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="bg-danger bg-opacity-10 rounded p-2 border border-danger border-opacity-25">
                            <small class="text-danger d-block fw-bold" style="font-size:0.7rem;">EGRESOS</small>
                            <span class="text-danger fw-bold">S/ ${sumaEgresos.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-light p-2 rounded-3 border border-light shadow-sm inset">
                    ${listaItemsHtml}
                </div>
            </div>`;
        });
    }

    document.getElementById('lista-historial-agrupado').innerHTML = htmlHistorial;
}

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
        modalCargaBackupInstancia = new bootstrap.Modal(document.getElementById('modalCargaBackup'));
    }
    
    // Capturar elementos de la interfaz
    let barra = document.getElementById('barra-progreso-backup');
    let icono = document.getElementById('icono-backup');
    let titulo = document.getElementById('titulo-backup');
    let texto = document.getElementById('texto-backup');
    let btnCerrar = document.getElementById('btn-cerrar-backup');

    // Reiniciar el estado visual del modal
    barra.style.width = '0%';
    barra.innerText = '0%';
    barra.classList.add('progress-bar-animated'); 
    icono.className = 'fas fa-spinner fa-spin text-success mb-3';
    titulo.innerText = 'Preparando tu respaldo...';
    texto.innerText = 'Empaquetando clientes, pagos y apuntes de forma segura.';
    btnCerrar.classList.add('d-none');

    modalCargaBackupInstancia.show();

    // Simular el progreso de carga
    let progreso = 0;
    let intervalo = setInterval(() => {
        progreso += Math.floor(Math.random() * 15) + 10; 
        
        if (progreso >= 100) {
            progreso = 100;
            clearInterval(intervalo);
            
            barra.style.width = progreso + '%';
            barra.innerText = progreso + '%';
            barra.classList.remove('progress-bar-animated'); // Detenemos la animación de las rayas

            // Esperar medio segundo, descargar y transformar la interfaz
            setTimeout(async () => {
                await ejecutarDescargaReal(incluirClientes, incluirPagos, incluirEgresos, incluirApuntes, incluirHabitaciones, incluirServicios);
                
                // Mostrar éxito y el botón de aceptar
                icono.className = 'fas fa-check-circle text-success mb-3';
                titulo.innerText = '¡Respaldo Completado!';
                texto.innerText = 'Tu archivo se ha procesado exitosamente.';
                btnCerrar.classList.remove('d-none');
                
            }, 500);
        } else {
            barra.style.width = progreso + '%';
            barra.innerText = progreso + '%';
        }
    }, 200);
}

// Nueva función exclusiva para cerrar el modal cuando el usuario decida
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

async function ejecutarDescargaReal(incluirClientes, incluirPagos, incluirEgresos, incluirApuntes, incluirHabitaciones, incluirServicios) {
    try {
        let exportData = {};
        
        if (incluirClientes) {
            exportData.clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
        }
        
        if (incluirPagos) {
            exportData.pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
        }

        if (incluirEgresos) {
            exportData.egresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
        }
        
        if (incluirApuntes) {
            exportData.apuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];
        }

        // Fase 4.3: Exportación de Habitaciones y Servicios
        if (incluirHabitaciones) {
            exportData.aldia_habitaciones = JSON.parse(localStorage.getItem('aldia_habitaciones')) || [];
        }

        if (incluirServicios) {
            exportData.aldia_servicios = JSON.parse(localStorage.getItem('aldia_servicios')) || [];
        }

        let dataStr = JSON.stringify(exportData, null, 2);
        let blob = new Blob([dataStr], { type: "application/json" });

        let fecha = new Date();
        let fechaStr = `${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}`;
        let fileName = `aldia_respaldo_${fechaStr}.json`;

        // Intento prioritario: Web Share API con soporte de archivos (móviles / WebView APKs)
        if (typeof File !== 'undefined' && typeof navigator !== 'undefined' && navigator.canShare) {
            try {
                let file = new File([blob], fileName, { type: "application/json" });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Respaldo Al Día',
                        text: 'Archivo de respaldo de Al Día'
                    });
                    return; // Compartido exitosamente en la aplicación de destino
                }
            } catch (shareErr) {
                if (shareErr.name === 'AbortError') {
                    return; // El usuario canceló la hoja para compartir
                }
                console.warn("Fallo Web Share API, procediendo a descarga tradicional:", shareErr);
            }
        }

        // Fallback: Descarga estándar mediante enlace <a> simulado
        let url = URL.createObjectURL(blob);
        let linkElement = document.createElement('a');
        linkElement.href = url;
        linkElement.download = fileName;
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (error) {
        alert("❌ Error al generar el respaldo: " + error.message);
    }
}

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
        } else {
            pagos.push({
                id: Date.now(),
                cliente_id: cliente.id,
                mes: mesActual,
                año: añoActual,
                monto: montoAlquilerFinal,
                pagado: true,
                metodo: "Liquidación Final",
                historico: `${cliente.nombre} ${cliente.apellido || ''}`.trim()
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
    if (confirm('¿Eliminar registro?')) {
        let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
        pagos = pagos.filter(p => Number(p.id) !== Number(id));
        localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
        location.reload();
    }
};

window.eliminarEgresoHistorial = function(id) {
    if (confirm('¿Eliminar registro?')) {
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
        <div class="row g-2">
            <div class="col-6">
                <label class="form-label text-muted small fw-bold" for="cli-nombre">Nombre</label>
                <input type="text" class="form-control" id="cli-nombre" placeholder="Nombre" required>
            </div>
            <div class="col-6">
                <label class="form-label text-muted small fw-bold" for="cli-apellido">Apellido</label>
                <input type="text" class="form-control" id="cli-apellido" placeholder="Apellido">
            </div>
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
            pagos.push({
                id: Date.now(),
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: totalCalculado,
                pagado: true,
                metodo: 'Efectivo',
                historico: `${nombre} ${apellido}`.trim(),
                es_garantia: false,
                fecha_pago_real: Date.now()
            });
        } else if ((frecuencia === 'diario' || frecuencia === 'semanal') && modalidad === 'opcion2') {
            // Pago Parcial (Tiempo) en Diario/Semanal
            const inputPeriodos = document.getElementById('inputPeriodosPagados');
            const periodosPagados = parseInt(inputPeriodos && inputPeriodos.value ? inputPeriodos.value : 1) || 1;
            const montoPagado = monto * periodosPagados;

            // Registro 1: Ingreso de hoy
            pagos.push({
                id: Date.now(),
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: montoPagado,
                pagado: true,
                metodo: 'Efectivo',
                historico: `${nombre} ${apellido} (Pago parcial)`.trim(),
                es_garantia: false,
                fecha_pago_real: Date.now()
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
            pagos.push({
                id: Date.now(),
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: montoAdelanto,
                pagado: true,
                metodo: 'Efectivo',
                historico: `${nombre} ${apellido} (Adelanto)`.trim(),
                es_garantia: false,
                fecha_pago_real: Date.now()
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
                pagos.push({
                    id: Date.now() + i,
                    cliente_id: idCliente,
                    mes: mesCobro,
                    año: añoCobro,
                    monto: monto,
                    pagado: true,
                    metodo: 'Efectivo',
                    historico: `${nombre} ${apellido}`.trim(),
                    es_garantia: false,
                    fecha_pago_real: Date.now()
                });
            }
        }
    }

    // 6. Registro de Garantía en aldia_pagos (si aplica)
    if (tieneGarantia && montoGarantia > 0) {
        if (pagadaGarantia) {
            pagos.push({
                id: Date.now() + 50,
                cliente_id: idCliente,
                mes: mesIni,
                año: anioIni,
                monto: montoGarantia,
                pagado: true,
                metodo: 'Efectivo',
                historico: `${nombre} (Garantía)`.trim(),
                es_garantia: true,
                fecha_pago_real: Date.now()
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
        if (inquilino) {
            badge = `<span class="badge bg-danger text-white"><i class="fas fa-user-lock me-1"></i>Ocupada por: ${inquilino.nombre}</span>`;
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

    let html = '';
    servicios.forEach(s => {
        const inscritos = clientes.filter(c => c.activo === true && (c.ref === s.nombre || (c.ref && s.nombre && c.ref.trim() === s.nombre.trim()) || String(c.ref) === String(s.id)));
        const cantidadInscritos = inscritos.length;

        let categoriaNombre = s.tipo || s.tipo_servicio || 'Servicio';
        if (categoriaNombre.toLowerCase() === 'academia') categoriaNombre = 'Inscripción de Alumnos';
        else if (categoriaNombre.toLowerCase() === 'streaming') categoriaNombre = 'Streaming';
        else if (categoriaNombre.toLowerCase() === 'otro') categoriaNombre = 'Otro servicio';

        const badgeInscritos = cantidadInscritos > 0
            ? `<span class="badge bg-primary text-white"><i class="fas fa-users me-1"></i>Inscritos: ${cantidadInscritos} personas</span>`
            : `<span class="badge bg-secondary text-white"><i class="fas fa-user-slash me-1"></i>Inscritos: 0 personas</span>`;

        html += `
        <div class="card border rounded-3 p-3 mb-2 shadow-sm bg-white">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <div class="d-flex align-items-center gap-2 mb-1">
                        <span class="badge bg-light text-primary border small fw-bold">${categoriaNombre}</span>
                        <h6 class="fw-bold mb-0 text-dark">${s.nombre}</h6>
                    </div>
                    <div class="text-muted small">
                        Precio: <span class="fw-semibold text-dark">S/ ${parseFloat(s.precio_base || 0).toFixed(2)}</span>
                        ${s.frecuencia_base ? `<span class="badge bg-light text-dark border ms-1">${s.frecuencia_base}</span>` : ''}
                    </div>
                    <div class="mt-2">
                        ${badgeInscritos}
                    </div>
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
        </div>`;
    });

    cont.innerHTML = html;
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
