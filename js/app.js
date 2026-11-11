
/* ==========================================
   MI GALERIA - APLICACION PRINCIPAL
   Archivo: app.js
   Recuperacion y sincronizacion Google Drive
========================================== */

"use strict";

function iniciarEventos() {
    $("btnInicio").addEventListener("click", () => navegar(null));

    $("buscador").addEventListener("input", async evento => {
        busquedaActual = evento.target.value.trim().toLowerCase();
        try {
            await mostrarContenido();
        } catch (error) {
            mostrarError(error);
        }
    });

    $("ordenar").addEventListener("change", async evento => {
        ordenActual = evento.target.value;
        try {
            await mostrarContenido();
        } catch (error) {
            mostrarError(error);
        }
    });

    $("opSeleccionar").addEventListener("click", seleccionarDesdeMenu);
    $("opRenombrar").addEventListener("click", renombrarElemento);
    $("opMover").addEventListener("click", moverElemento);
    $("opEliminar").addEventListener("click", eliminarElemento);
    $("btnMoverSeleccion").addEventListener("click", moverSeleccionados);
    $("btnEliminarSeleccion").addEventListener("click", eliminarSeleccionados);
    $("btnCancelarSeleccion").addEventListener("click", cancelarSeleccion);

    document.addEventListener("click", evento => {
        const menu = $("menuContextual");

        if (
            menu &&
            !menu.contains(evento.target) &&
            !evento.target.closest(".boton-menu")
        ) {
            cerrarMenu();
        }
    });

    iniciarEventosVisor();
    iniciarEventosModales();
}

/* ==========================================
   LEER Y VALIDAR RESPALDO DE GOOGLE DRIVE
========================================== */

async function leerRespaldoGoogleDrive() {
    const drive = window.MiGaleriaGoogleDrive;

    if (!drive || !drive.disponible()) {
        throw new Error("Primero conecta Google Drive.");
    }

    const archivo = await drive.buscarMetadatos();

    if (!archivo) {
        throw new Error(
            "No existe mi-galeria-metadata.json. " +
            "Primero guarda la estructura en Google Drive."
        );
    }

    const blob = await drive.descargarArchivo(archivo.id);
    let respaldo;

    try {
        respaldo = JSON.parse(await blob.text());
    } catch (_) {
        throw new Error("El respaldo no contiene JSON valido.");
    }

    if (
        !respaldo ||
        respaldo.formato !== "MiGaleriaDrive" ||
        respaldo.version !== 1 ||
        !Array.isArray(respaldo.carpetas) ||
        !Array.isArray(respaldo.archivos)
    ) {
        throw new Error(
            "El respaldo no tiene un formato compatible."
        );
    }

    return respaldo;
}

/* ==========================================
   RECUPERAR ARCHIVOS A SU CARPETA ORIGINAL
   Solo al pulsar el boton.
========================================== */

let recuperacionEnProceso = false;

async function recuperarArchivosGoogleDrive() {
    if (recuperacionEnProceso) return;

    const drive = window.MiGaleriaGoogleDrive;

    if (!drive || !drive.disponible()) {
        alert("Primero conecta Google Drive.");
        return;
    }

    const confirmar = confirm(
        "Se consultara mi-galeria-metadata.json y se descargaran " +
        "solo los archivos respaldados que falten localmente.\n\n" +
        "Cada archivo volvera a su carpeta original.\n" +
        "Los archivos pendientes sin driveId NO se descargaran.\n" +
        "No se eliminaran archivos ni carpetas locales.\n\n" +
        "¿Continuar?"
    );

    if (!confirmar) return;

    recuperacionEnProceso = true;

    const boton = $("btnRecuperarGoogleDrive");

    if (boton) {
        boton.disabled = true;
        boton.textContent = "Recuperando archivos...";
    }

    let recuperados = 0;
    let existentes = 0;
    let pendientes = 0;
    let sinCarpeta = 0;
    let errores = 0;

    const detalles = [];

    try {
        drive.actualizarEstado(
            "Leyendo respaldo de Google Drive..."
        );

        const respaldo = await leerRespaldoGoogleDrive();
        const locales = await obtenerTodos("archivos");
        const carpetas = await obtenerTodos("carpetas");

        const idsCarpetas = new Set(
            carpetas.map(c => c.id)
        );

        const porId = new Map(
            locales.map(a => [a.id, a])
        );

        const porDriveId = new Map(
            locales
                .filter(a => a.driveId)
                .map(a => [a.driveId, a])
        );

        const idsRespaldo = new Set();

        for (const remoto of respaldo.archivos) {
            if (
                !remoto ||
                typeof remoto.id !== "string" ||
                !remoto.id.trim() ||
                typeof remoto.nombre !== "string" ||
                typeof remoto.tipo !== "string" ||
                (
                    remoto.carpeta != null &&
                    typeof remoto.carpeta !== "string"
                )
            ) {
                errores++;
                detalles.push(
                    "Registro de archivo invalido en el respaldo."
                );
                continue;
            }

            if (idsRespaldo.has(remoto.id)) {
                errores++;
                detalles.push("ID repetido: " + remoto.id);
                continue;
            }

            idsRespaldo.add(remoto.id);

            if (
                !remoto.driveId ||
                typeof remoto.driveId !== "string"
            ) {
                pendientes++;
                continue;
            }

            const local =
                porId.get(remoto.id) ||
                porDriveId.get(remoto.driveId);

            if (local && local.datos instanceof Blob) {
                existentes++;
                continue;
            }

            if (
                remoto.carpeta != null &&
                !idsCarpetas.has(remoto.carpeta)
            ) {
                sinCarpeta++;
                detalles.push(
                    "Falta carpeta de: " + remoto.nombre
                );
                continue;
            }

            if (
                local &&
                local.driveId &&
                local.driveId !== remoto.driveId
            ) {
                errores++;
                detalles.push(
                    "Conflicto de ID: " + remoto.nombre
                );
                continue;
            }

            try {
                drive.actualizarEstado(
                    "Descargando: " + remoto.nombre
                );

                const datos = await drive.descargarArchivo(
                    remoto.driveId
                );

                if (!(datos instanceof Blob)) {
                    throw new Error(
                        "Google Drive no devolvio un Blob."
                    );
                }

                const registro = local
                    ? { ...local }
                    : {
                        id: remoto.id,
                        nombre: remoto.nombre,
                        tipo: remoto.tipo,
                        carpeta: remoto.carpeta ?? null,
                        fecha: remoto.fecha || Date.now()
                    };

                registro.datos = datos;
                registro.driveId = remoto.driveId;
                registro.sincronizacion = "sincronizado";

                await guardar("archivos", registro);

                porId.set(registro.id, registro);
                porDriveId.set(registro.driveId, registro);

                recuperados++;

            } catch (error) {
                errores++;

                detalles.push(
                    remoto.nombre + ": " + error.message
                );

                console.error(
                    "Error recuperando",
                    remoto.nombre,
                    error
                );
            }
        }

        await mostrarContenido();

        drive.actualizarEstado(
            errores || sinCarpeta
                ? "Recuperacion parcial"
                : "Recuperacion completada"
        );

        alert(
            "Recuperacion terminada.\n\n" +
            "Archivos recuperados: " + recuperados + "\n" +
            "Archivos que ya existian: " + existentes + "\n" +
            "Sin copia en Drive: " + pendientes + "\n" +
            "Con carpeta faltante: " + sinCarpeta + "\n" +
            "Errores: " + errores + "\n\n" +
            "No se eliminaron archivos locales." +
            (
                detalles.length
                    ? "\n\nDetalles:\n" +
                      detalles.slice(0, 5).join("\n")
                    : ""
            )
        );

    } catch (error) {
        console.error(
            "Error recuperando archivos:",
            error
        );

        drive.actualizarEstado(
            "Error recuperando archivos"
        );

        alert(
            "No se pudo completar la recuperacion:\n" +
            error.message
        );

    } finally {
        recuperacionEnProceso = false;

        if (boton) {
            boton.disabled = false;
            boton.textContent =
                "Recuperar desde Google Drive";
        }
    }
}

function iniciarBotonRecuperacion() {
    const menu = $("panelMenuAjustes");

    if (!menu || $("btnRecuperarGoogleDrive")) {
        return;
    }

    const boton = document.createElement("button");

    boton.id = "btnRecuperarGoogleDrive";
    boton.type = "button";
    boton.textContent = "Recuperar desde Google Drive";

    boton.addEventListener(
        "click",
        recuperarArchivosGoogleDrive
    );

    const referencia = $("btnListarGoogleDrive");

    if (referencia) {
        referencia.after(boton);
    } else {
        menu.appendChild(boton);
    }
}

/* ==========================================
   RECUPERAR CARPETAS Y PORTADAS
========================================== */

let recuperacionEstructuraEnProceso = false;

async function recuperarEstructuraGoogleDrive() {
    if (recuperacionEstructuraEnProceso) return;

    const drive = window.MiGaleriaGoogleDrive;

    if (!drive || !drive.disponible()) {
        alert("Primero conecta Google Drive.");
        return;
    }

    if (!confirm(
        "Se recuperaran las carpetas y referencias de portadas " +
        "que falten desde Google Drive.\n\n" +
        "No se eliminaran archivos locales ni se descargaran imagenes.\n" +
        "No se reemplazaran portadas locales existentes.\n\n" +
        "¿Continuar?"
    )) {
        return;
    }

    recuperacionEstructuraEnProceso = true;

    const boton = $("btnRecuperarEstructuraDrive");

    if (boton) {
        boton.disabled = true;
        boton.textContent = "Recuperando estructura...";
    }

    try {
        drive.actualizarEstado(
            "Leyendo estructura de Google Drive..."
        );

        const respaldo = await leerRespaldoGoogleDrive();
        const locales = await obtenerTodos("carpetas");

        const porId = new Map(
            locales.map(c => [c.id, c])
        );

        const idsRemotos = new Set();

        for (const carpeta of respaldo.carpetas) {
            if (
                !carpeta ||
                typeof carpeta.id !== "string" ||
                !carpeta.id.trim() ||
                typeof carpeta.nombre !== "string" ||
                !carpeta.nombre.trim() ||
                (
                    carpeta.padre != null &&
                    typeof carpeta.padre !== "string"
                ) ||
                (
                    carpeta.portadaArchivoId != null &&
                    typeof carpeta.portadaArchivoId !== "string"
                ) ||
                idsRemotos.has(carpeta.id)
            ) {
                throw new Error(
                    "El respaldo contiene carpetas invalidas o IDs repetidos."
                );
            }

            idsRemotos.add(carpeta.id);
        }

        const disponibles = new Set([
            ...porId.keys(),
            ...idsRemotos
        ]);

        let recuperadas = 0;
        let existentes = 0;
        let omitidas = 0;
        let portadasRecuperadas = 0;
        let portadasConservadas = 0;

        for (const carpeta of respaldo.carpetas) {
            const local = porId.get(carpeta.id);

            if (local) {
                existentes++;

                if (
                    local.portadaArchivoId ||
                    local.portadaPersonalizada instanceof Blob
                ) {
                    portadasConservadas++;
                    continue;
                }

                if (local.portadaSinImagen === true) {
                    continue;
                }

                if (carpeta.portadaArchivoId) {
                    local.portadaArchivoId =
                        carpeta.portadaArchivoId;

                    await guardar("carpetas", local);
                    portadasRecuperadas++;
                }

                continue;
            }

            if (
                carpeta.padre != null &&
                !disponibles.has(carpeta.padre)
            ) {
                omitidas++;
                continue;
            }

            const nueva = {
                id: carpeta.id,
                nombre: carpeta.nombre,
                padre: carpeta.padre ?? null,
                fecha: carpeta.fecha || Date.now(),
                portadaSinImagen:
                    carpeta.portadaSinImagen === true
            };

            if (carpeta.portadaArchivoId) {
                nueva.portadaArchivoId =
                    carpeta.portadaArchivoId;

                portadasRecuperadas++;
            }

            await guardar("carpetas", nueva);

            porId.set(nueva.id, nueva);
            recuperadas++;
        }

        await mostrarContenido();

        drive.actualizarEstado(
            "Estructura recuperada de Google Drive"
        );

        alert(
            "Recuperacion terminada.\n\n" +
            "Carpetas recuperadas: " + recuperadas + "\n" +
            "Carpetas que ya existian: " + existentes + "\n" +
            "Carpetas omitidas: " + omitidas + "\n" +
            "Referencias de portada recuperadas: " +
            portadasRecuperadas + "\n" +
            "Portadas locales conservadas: " +
            portadasConservadas + "\n\n" +
            "No se eliminaron archivos locales.\n" +
            "No se descargaron imagenes ni videos."
        );

    } catch (error) {
        console.error(
            "Error recuperando estructura:",
            error
        );

        drive.actualizarEstado(
            "Error recuperando estructura"
        );

        alert(
            "No se pudo recuperar la estructura:\n" +
            error.message
        );

    } finally {
        recuperacionEstructuraEnProceso = false;

        if (boton) {
            boton.disabled = false;
            boton.textContent =
                "Recuperar estructura de Google Drive";
        }
    }
}

function iniciarBotonRecuperarEstructura() {
    const menu = $("panelMenuAjustes");

    if (!menu || $("btnRecuperarEstructuraDrive")) {
        return;
    }

    const boton = document.createElement("button");

    boton.id = "btnRecuperarEstructuraDrive";
    boton.type = "button";

    boton.textContent =
        "Recuperar estructura de Google Drive";

    boton.addEventListener(
        "click",
        recuperarEstructuraGoogleDrive
    );

    const referencia = $("btnGuardarMetadatosDrive");

    if (referencia) {
        referencia.after(boton);
    } else {
        menu.appendChild(boton);
    }
}

/* ==========================================
   SINCRONIZACION SEGURA DESDE GOOGLE DRIVE

   Solo agrega carpetas y referencias nuevas.
   No descarga originales.
   No elimina ni sobrescribe datos existentes.
========================================== */

let sincronizacionLecturaEnProceso = false;

async function sincronizarNuevosDesdeGoogleDrive() {
    if (
        sincronizacionLecturaEnProceso ||
        recuperacionEnProceso ||
        recuperacionEstructuraEnProceso
    ) {
        return;
    }

    const drive = window.MiGaleriaGoogleDrive;

    if (!drive?.disponible?.() || !db) {
        return;
    }

    sincronizacionLecturaEnProceso = true;

    let nuevasCarpetas = 0;
    let nuevosArchivos = 0;
    let conflictos = 0;

    try {
        drive.actualizarEstado(
            "Consultando novedades de Google Drive..."
        );

        const remoto = await leerRespaldoGoogleDrive();

        const [carpetas, archivos] = await Promise.all([
            obtenerTodos("carpetas"),
            obtenerTodos("archivos")
        ]);

        const carpetasLocales = new Set(
            carpetas.map(c => c.id)
        );

        const idsRemotos = new Set();
        const pendientes = new Map();

        /* ==================================
           VALIDAR CARPETAS REMOTAS
        ================================== */

        for (const c of remoto.carpetas) {
            if (
                !c ||
                typeof c.id !== "string" ||
                !c.id.trim() ||
                typeof c.nombre !== "string" ||
                !c.nombre.trim() ||
                (
                    c.padre != null &&
                    typeof c.padre !== "string"
                ) ||
                idsRemotos.has(c.id)
            ) {
                throw new Error(
                    "El respaldo contiene carpetas invalidas o repetidas."
                );
            }

            idsRemotos.add(c.id);

            if (!carpetasLocales.has(c.id)) {
                pendientes.set(c.id, c);
            }
        }

        /* ==================================
           INSERTAR PADRES ANTES QUE HIJOS
        ================================== */

        while (pendientes.size) {
            let avance = false;

            for (const [id, c] of pendientes) {
                if (
                    c.padre != null &&
                    !carpetasLocales.has(c.padre)
                ) {
                    continue;
                }

                await guardar("carpetas", {
                    id: c.id,
                    nombre: c.nombre,
                    padre: c.padre ?? null,
                    fecha: c.fecha || Date.now(),
                    portadaSinImagen:
                        c.portadaSinImagen === true,
                    portadaArchivoId:
                        c.portadaArchivoId || null
                });

                carpetasLocales.add(id);
                pendientes.delete(id);

                nuevasCarpetas++;
                avance = true;
            }

            if (!avance) {
                conflictos += pendientes.size;

                console.warn(
                    "Carpetas remotas con padres ausentes o ciclos:",
                    [...pendientes.keys()]
                );

                break;
            }
        }

        /* ==================================
           PREPARAR ARCHIVOS LOCALES
        ================================== */

        const porId = new Map(
            archivos.map(a => [a.id, a])
        );

        const porDriveId = new Set(
            archivos
                .filter(a => a.driveId)
                .map(a => a.driveId)
        );

        const archivosRemotos = new Set();

        /* ==================================
           AGREGAR SOLO ARCHIVOS NUEVOS
        ================================== */

        for (const a of remoto.archivos) {
            if (
                !a ||
                typeof a.id !== "string" ||
                !a.id.trim() ||
                typeof a.nombre !== "string" ||
                typeof a.tipo !== "string" ||
                (
                    a.carpeta != null &&
                    typeof a.carpeta !== "string"
                ) ||
                archivosRemotos.has(a.id)
            ) {
                conflictos++;
                continue;
            }

            archivosRemotos.add(a.id);

            if (
                !a.driveId ||
                typeof a.driveId !== "string"
            ) {
                continue;
            }

            if (
                porId.has(a.id) ||
                porDriveId.has(a.driveId)
            ) {
                continue;
            }

            if (
                a.carpeta != null &&
                !carpetasLocales.has(a.carpeta)
            ) {
                conflictos++;
                continue;
            }

            await guardar("archivos", {
                id: a.id,
                nombre: a.nombre,
                tipo: a.tipo,
                carpeta: a.carpeta ?? null,
                fecha: a.fecha || Date.now(),
                driveId: a.driveId,
                sincronizacion: "sincronizado"
            });

            porId.set(a.id, a);
            porDriveId.add(a.driveId);

            nuevosArchivos++;
        }

        /* ==================================
           ACTUALIZAR VISTA
        ================================== */

        await mostrarContenido();

        const mensaje =
            `Sincronizacion: ${nuevasCarpetas} carpetas y ` +
            `${nuevosArchivos} archivos nuevos` +
            (
                conflictos
                    ? `; ${conflictos} registros omitidos`
                    : ""
            );

        drive.actualizarEstado(mensaje);

        console.info(mensaje);

    } catch (error) {
        console.warn(
            "Sincronizacion automatica no completada:",
            error
        );

        drive.actualizarEstado(
            "No se pudieron consultar novedades de Drive"
        );

    } finally {
        sincronizacionLecturaEnProceso = false;
    }
}

/* ==========================================
   SINCRONIZACION AUTOMATICA TEMPORALMENTE
   DESACTIVADA

   Evita recuperar carpetas antiguas de Drive
   mientras corregimos la sincronizacion.

   No elimina archivos de Google Drive.
========================================== */

// window.addEventListener(
//     "miGaleriaDriveConectado",
//     () => {
//         void sincronizarNuevosDesdeGoogleDrive();
//     }
// );

/* ==========================================
   INICIAR APLICACION
========================================== */

async function iniciar() {
    try {
        await iniciarDB();

        iniciarEventos();

        iniciarBotonRecuperacion();
        iniciarBotonRecuperarEstructura();

        await mostrarContenido();

        console.log(
            "Mi Galeria iniciada correctamente."
        );

    } catch (error) {
        console.error(error);
        mostrarError(error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        iniciar
    );
} else {
    iniciar();
}
