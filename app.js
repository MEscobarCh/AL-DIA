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
    
    // Configurar formularios
    document.getElementById('form-nuevo-cliente').addEventListener('submit', guardarNuevoCliente);
    let formEgreso = document.getElementById('form-nuevo-egreso');
    if(formEgreso) formEgreso.addEventListener('submit', guardarNuevoEgreso);
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
            // Buscamos si pagó la cuota mensual (ignorando la garantía aquí)
            let pago = pagos.find(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && !p.es_garantia);

            if (pago && pago.pagado) {
                totalIngresos += parseFloat(pago.monto);

                // --- SECCIÓN: YA PAGADOS (Sin lápiz de edición) ---
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
                            <small class="text-muted"><i class="fas fa-wallet me-1"></i> ${pago.metodo}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="fw-bold text-success fs-5 me-2">S/ ${parseFloat(pago.monto).toFixed(2)}</span>
                            ${botonExtraHtml}
                            <button class="btn btn-sm btn-outline-secondary rounded-circle shadow-sm" style="width: 35px; height: 35px; padding: 0;" onclick="revertirPago(${pago.id}, '${cliente.nombre}')" title="Revertir cobro"><i class="fas fa-undo-alt"></i></button>
                        </div>
                    </div>
                </div>`;
            } else {
                listaPendientes.push({ tipo: 'cuota', cliente: cliente });
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

            let pago = pagos.find(p => p.cliente_id === cliente.id && p.mes === mesVisualizado && p.año === añoVisualizado && !p.es_garantia);
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
            localStorage.setItem('aldia_pagos', JSON.stringify(pagos));
        }
    }
    
    modalInstancia.hide();
    renderizarDashboard();
}

// --- NUEVA FUNCIÓN: REVERTIR COBRO ---
function revertirPago(pagoId, nombre) {
    if(confirm(`⚠️ ¿Seguro que deseas REVERTIR el cobro de ${nombre}?`)) {
        guardarSnapshot();
        let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
        let index = pagos.findIndex(p => p.id === pagoId);
        
        if(index !== -1) {
            if (pagos[index].es_garantia) {
                // Revertimos la garantía en el perfil del cliente
                let clientes = JSON.parse(localStorage.getItem('aldia_clientes'));
                let cIndex = clientes.findIndex(c => c.id === pagos[index].cliente_id);
                if (cIndex !== -1) {
                    clientes[cIndex].garantia_pagada = false;
                    localStorage.setItem('aldia_clientes', JSON.stringify(clientes));
                }
                // Borramos el recibo falso del historial
                pagos.splice(index, 1);
            } else {
                // Revertimos el pago mensual normal
                pagos[index].pagado = false;
                pagos[index].metodo = "";
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
    
    // 2. Capturar si es Cuarto o Streaming
    let chkStreaming = document.getElementById('tipo-streaming');
    let esStreaming = chkStreaming ? chkStreaming.checked : false;
    let tipoServicio = esStreaming ? 'streaming' : 'cuarto';
    
    // 3. Capturar datos de la garantía (Forzamos a 0 si es Streaming)
    let tieneGarantia = esStreaming ? false : document.getElementById('chk-tiene-garantia').checked;
    let montoGarantia = tieneGarantia ? (parseFloat(document.getElementById('cli-garantia-monto').value) || 0) : 0;
    let pagadaGarantia = tieneGarantia ? document.getElementById('chk-garantia-pagada').checked : false;
    let fechaGarantia = tieneGarantia ? document.getElementById('cli-garantia-fecha').value : "";

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
            id: Date.now() + 500,
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

    let borrarRecibos = chkRecibos ? chkRecibos.checked : false;
    let borrarEgresos = chkEgresos ? chkEgresos.checked : false;
    let borrarApuntes = chkApuntes ? chkApuntes.checked : false;
    let borrarClientes = chkClientes ? chkClientes.checked : false;

    if (!borrarRecibos && !borrarEgresos && !borrarApuntes && !borrarClientes) {
        alert("⚠️ Selecciona al menos una categoría para eliminar.");
        return;
    }

    let modulos = [];
    if (borrarRecibos) modulos.push("• Historial de Recibos Pagados");
    if (borrarEgresos) modulos.push("• Historial de Egresos");
    if (borrarApuntes) modulos.push("• Mis Apuntes");
    if (borrarClientes) modulos.push("• Todos los Clientes y Deudas Pendientes");

    let mensajeConfirm = "⚠️ ¿Confirmas la eliminación de los siguientes elementos?\n\n" + 
        modulos.join('\n') + 
        "\n\n(Podrás deshacer esta acción inmediatamente usando el Salvavidas).";

    if (!confirm(mensajeConfirm)) {
        return;
    }

    // 1. Guardar snapshot de seguridad antes de modificar nada
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

    // 3. Cerrar modal si está abierto
    if (modalBorradoSelectivoInstancia) {
        modalBorradoSelectivoInstancia.hide();
    }

    // 4. Mostrar aviso con opción de deshacer y actualizar interfaces
    mostrarToastDeshacer("Elementos eliminados correctamente.");

    renderizarDashboard();
    renderizarEstadisticas();
    if (typeof renderizarCalendario === 'function') renderizarCalendario();
    if (typeof renderizarApuntes === 'function') renderizarApuntes();
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

        // Extraer la Fecha y Hora exactas del Pago 
        let fechaPagoDate = new Date(pago.id);
        let fechaStr = "";
        
        if(fechaPagoDate.getTime() > 1600000000000) { 
            let d = fechaPagoDate.getDate().toString().padStart(2, '0');
            let m = (fechaPagoDate.getMonth() + 1).toString().padStart(2, '0');
            let y = fechaPagoDate.getFullYear();
            let hrs = fechaPagoDate.getHours().toString().padStart(2, '0');
            let mins = fechaPagoDate.getMinutes().toString().padStart(2, '0');
            fechaStr = `${d}/${m}/${y} a las ${hrs}:${mins}`;
        } else {
            fechaStr = `Mes ${pago.mes}/${pago.año}`;
        }

        historialAgrupado[key].ingresos.push({ 
            id: pago.id, 
            tipo: 'ingreso', 
            desc: pago.historico, 
            badge: badgeHtml,
            monto: pago.monto, 
            metodo: pago.metodo, 
            fechaStr: fechaStr 
        });
    });

    // 2. Agrupar Egresos (NUEVA LÓGICA DE FECHAS Y HORA)
    egresos.forEach(egr => {
        let key = `${egr.año}-${String(egr.mes).padStart(2, '0')}`;
        if (!historialAgrupado[key]) historialAgrupado[key] = { mes: egr.mes, año: egr.año, ingresos: [], egresos: [] };
        
        // Extraemos la fecha del ID de creación del egreso
        let fechaEgresoDate = new Date(egr.id);
        let fechaStrEgr = "";
        
        if(fechaEgresoDate.getTime() > 1600000000000) { 
            let d = fechaEgresoDate.getDate().toString().padStart(2, '0');
            let m = (fechaEgresoDate.getMonth() + 1).toString().padStart(2, '0');
            let y = fechaEgresoDate.getFullYear();
            let hrs = fechaEgresoDate.getHours().toString().padStart(2, '0');
            let mins = fechaEgresoDate.getMinutes().toString().padStart(2, '0');
            fechaStrEgr = `${d}/${m}/${y} a las ${hrs}:${mins}`;
        } else {
            fechaStrEgr = `${String(egr.dia).padStart(2, '0')}/${String(egr.mes).padStart(2, '0')}/${egr.año}`;
        }

        historialAgrupado[key].egresos.push({ id: egr.id, tipo: 'egreso', desc: egr.motivo, monto: egr.monto, fechaStr: fechaStrEgr });
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
                            <button class="btn btn-sm btn-outline-danger" style="width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="revertirPago(${ing.id}, '${(ing.desc || '').replace(/'/g, "\\'")}')" title="Eliminar / Revertir cobro"><i class="fas fa-trash-alt" style="font-size: 0.75rem;"></i></button>
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
                            <button class="btn btn-sm btn-outline-danger" style="width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="eliminarEgreso(${egr.id})" title="Eliminar gasto"><i class="fas fa-trash-alt" style="font-size: 0.75rem;"></i></button>
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
    if(pantallaId === 'apuntes') renderizarApuntes(); // <--- NUEVA LÍNEA
    
    window.scrollTo(0, 0);
}

// ==========================================
// --- SISTEMA DE BACKUP Y RESTAURACIÓN ---
// ==========================================

let modalCargaBackupInstancia = null;

function exportarDatos() {
    let chkClientes = document.getElementById('chk-export-clientes');
    let chkPagos = document.getElementById('chk-export-pagos');
    let chkEgresos = document.getElementById('chk-export-egresos');
    let chkApuntes = document.getElementById('chk-export-apuntes');

    let incluirClientes = chkClientes ? chkClientes.checked : true;
    let incluirPagos = chkPagos ? chkPagos.checked : true;
    let incluirEgresos = chkEgresos ? chkEgresos.checked : true;
    let incluirApuntes = chkApuntes ? chkApuntes.checked : true;

    if (!incluirClientes && !incluirPagos && !incluirEgresos && !incluirApuntes) {
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
            setTimeout(() => {
                ejecutarDescargaReal(incluirClientes, incluirPagos, incluirEgresos, incluirApuntes);
                
                // Mostrar éxito y el botón de aceptar
                icono.className = 'fas fa-check-circle text-success mb-3';
                titulo.innerText = '¡Respaldo Completado!';
                texto.innerText = 'Tu archivo se ha descargado exitosamente.';
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
}

function ejecutarDescargaReal(incluirClientes, incluirPagos, incluirEgresos, incluirApuntes) {
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

        let dataStr = JSON.stringify(exportData, null, 2);
        let blob = new Blob([dataStr], { type: "application/json" });
        let url = URL.createObjectURL(blob);

        let fecha = new Date();
        let fechaStr = `${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}`;
        let fileName = `aldia_respaldo_${fechaStr}.json`;

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
                ejecutarRestauracion(data);
            }
        } catch (err) {
            alert("❌ El archivo no es válido o está dañado.");
        }
        e.target.value = ""; // Limpiar input
    };
    reader.readAsText(archivo);
}

function ejecutarRestauracion(data) {
    let currentClientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let currentPagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    let currentEgresos = JSON.parse(localStorage.getItem('aldia_egresos')) || [];
    let currentApuntes = JSON.parse(localStorage.getItem('aldia_apuntes')) || [];

    let mapeoNuevosIds = {}; // Para reconectar pagos si el ID del cliente cambia

    // 1. RESTAURAR CLIENTES (Evitando choques)
    if (data.clientes) {
        data.clientes.forEach(impCli => {
            let existe = currentClientes.find(c => c.id === impCli.id || (c.nombre === impCli.nombre && c.apellido === impCli.apellido));
            
            if (existe) {
                let decision = confirm(`El cliente "${impCli.nombre}" ya existe.\n\n• ACEPTAR: Combinar recibos con el actual.\n• CANCELAR: Crear como cliente nuevo (duplicado).`);
                if (decision) {
                    mapeoNuevosIds[impCli.id] = existe.id;
                } else {
                    let nuevoId = Date.now() + Math.floor(Math.random() * 10000);
                    currentClientes.push({ ...impCli, id: nuevoId, nombre: impCli.nombre + " (Importado)" });
                    mapeoNuevosIds[impCli.id] = nuevoId;
                }
            } else {
                currentClientes.push(impCli);
                mapeoNuevosIds[impCli.id] = impCli.id;
            }
        });
    }

    // 2. RESTAURAR PAGOS (Conexión inteligente)
    if (data.pagos) {
        data.pagos.forEach(pImp => {
            let idDestino = mapeoNuevosIds[pImp.cliente_id] || pImp.cliente_id;
            // Evitar duplicar el mismo recibo exacto
            let pagoExiste = currentPagos.find(p => p.cliente_id === idDestino && p.mes === pImp.mes && p.año === pImp.año && (p.es_garantia === pImp.es_garantia));
            
            if (!pagoExiste) {
                currentPagos.push({ ...pImp, id: Date.now() + Math.floor(Math.random() * 100000), cliente_id: idDestino });
            }
        });
    }

    // 3. RESTAURAR EGRESOS (Seguridad Anti-Clones)
    if (data.egresos) {
        data.egresos.forEach(eImp => {
            // Busca si ya existe un gasto con el mismo ID, o idéntico en fecha, motivo y monto
            let egresoExiste = currentEgresos.find(e => e.id === eImp.id || (e.fecha === eImp.fecha && e.motivo === eImp.motivo && parseFloat(e.monto) === parseFloat(eImp.monto)));
            if (!egresoExiste) {
                // Le asignamos un nuevo ID único por seguridad
                currentEgresos.push({ ...eImp, id: Date.now() + Math.floor(Math.random() * 100000) });
            }
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

    alert("✅ ¡Restauración exitosa!\nSe han procesado clientes, recibos, egresos y apuntes de forma segura.");
    location.reload(); 
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
                    id: Date.now() + Math.floor(Math.random() * 1000),
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
        apuntes: localStorage.getItem('aldia_apuntes')
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
        
        if(snapshot.clientes) localStorage.setItem('aldia_clientes', snapshot.clientes);
        if(snapshot.pagos) localStorage.setItem('aldia_pagos', snapshot.pagos);
        if(snapshot.egresos) localStorage.setItem('aldia_egresos', snapshot.egresos);
        if(snapshot.apuntes) localStorage.setItem('aldia_apuntes', snapshot.apuntes);
        
        // Una vez que lo usamos exitosamente, ahora sí limpiamos la memoria
        localStorage.removeItem('aldia_undo');
        cerrarToast();
        
        alert(mensajeExito);
        
        renderizarDashboard();
        renderizarEstadisticas();
        if (typeof renderizarCalendario === 'function') renderizarCalendario();
        if (typeof renderizarApuntes === 'function') renderizarApuntes();
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
        document.getElementById('edit-cli-ref').value = cliente.ref || '';
        
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
    let nuevaRef = document.getElementById('edit-cli-ref').value.trim();
    
    let clientes = JSON.parse(localStorage.getItem('aldia_clientes')) || [];
    let pagos = JSON.parse(localStorage.getItem('aldia_pagos')) || [];
    
    let cIndex = clientes.findIndex(c => c.id === id);
    
    if (cIndex !== -1) {
        // 1. Actualizamos el perfil base del cliente
        clientes[cIndex].nombre = nuevoNombre;
        clientes[cIndex].apellido = nuevoApellido;
        clientes[cIndex].monto = nuevoMonto;
        clientes[cIndex].dia = nuevoDia;
        clientes[cIndex].ref = nuevaRef;
        
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