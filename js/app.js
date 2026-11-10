
/* ==========================================
   MI GALERIA - APLICACION PRINCIPAL
   Archivo: app.js
========================================== */

"use strict";

/* ==========================================
   EVENTOS PRINCIPALES
========================================== */

function iniciarEventos() {

    $("btnInicio").addEventListener(
        "click",
        () => navegar(null)
    );

    $("buscador").addEventListener(
        "input",
        async evento => {

            busquedaActual = evento.target.value
                .trim()
                .toLowerCase();

            try {
                await mostrarContenido();
            } catch (error) {
                mostrarError(error);
            }
        }
    );

    $("ordenar").addEventListener(
        "change",
        async evento => {

            ordenActual = evento.target.value;

            try {
                await mostrarContenido();
            } catch (error) {
                mostrarError(error);
            }
        }
    );

    $("opSeleccionar").addEventListener(
        "click",
        seleccionarDesdeMenu
    );

    $("opRenombrar").addEventListener(
        "click",
        renombrarElemento
    );

    $("opMover").addEventListener(
        "click",
        moverElemento
    );

    $("opEliminar").addEventListener(
        "click",
        eliminarElemento
    );

    $("btnMoverSeleccion").addEventListener(
        "click",
        moverSeleccionados
    );

    $("btnEliminarSeleccion").addEventListener(
        "click",
        eliminarSeleccionados
    );

    $("btnCancelarSeleccion").addEventListener(
        "click",
        cancelarSeleccion
    );

    document.addEventListener(
        "click",
        evento => {

            const menu = $("menuContextual");

            if (
                !menu.contains(evento.target) &&
                !evento.target.closest(".boton-menu")
            ) {
                cerrarMenu();
            }
        }
    );

    iniciarEventosVisor();
    iniciarEventosModales();
}

/* ==========================================
   SINCRONIZACION GOOGLE DRIVE
========================================== */

let recuperacionEnProceso = false;

async function recuperarArchivosGoogleDrive(
    automatico = false
) {

    if (recuperacionEnProceso) return;

    const drive = window.MiGaleriaGoogleDrive;

    if (!drive || !drive.disponible()) {

        if (!automatico) {
            alert(
                "Primero debes conectar Google Drive."
            );
        }

        return;
    }

    if (!automatico) {

        const confirmar = confirm(
            "Se consultaran los archivos de Google Drive " +
            "y se recuperaran los que falten.\n\n" +
            "No se eliminaran archivos.\n\n" +
            "¿Continuar?"
        );

        if (!confirmar) return;
    }

    recuperacionEnProceso = true;

    const boton = $("btnRecuperarGoogleDrive");

    if (boton) {
        boton.disabled = true;
        boton.textContent = "Sincronizando...";
    }

    let recuperados = 0;
    let existentes = 0;
    let vinculados = 0;
    let errores = 0;

    try {

        drive.actualizarEstado(
            "Consultando Google Drive..."
        );

        const archivosDrive =
            await drive.listarArchivos();

        const archivosLocales =
            await obtenerTodos("archivos");

        const idsRegistrados = new Set(
            archivosLocales
                .filter(a => a.driveId)
                .map(a => a.driveId)
        );

        const archivosPorClave = new Map();

        for (const archivo of archivosLocales) {

            if (archivo.driveId) continue;

            const clave =
                archivo.nombre + "|" +
                (archivo.datos?.size ?? "") + "|" +
                (archivo.tipo || "");

            if (!archivosPorClave.has(clave)) {
                archivosPorClave.set(clave, []);
            }

            archivosPorClave.get(clave).push(archivo);
        }

        const archivosValidos = archivosDrive.filter(
            archivo => {

                const tipo = archivo.mimeType || "";

                return (
                    tipo.startsWith("image/") ||
                    tipo.startsWith("video/")
                );
            }
        );

        let procesados = 0;

        for (const archivo of archivosValidos) {

            procesados++;

            drive.actualizarEstado(
                "Sincronizando " +
                procesados + " de " +
                archivosValidos.length
            );

            if (idsRegistrados.has(archivo.id)) {
                existentes++;
                continue;
            }

            try {

                const datos =
                    await drive.descargarArchivo(
                        archivo.id
                    );

                const tipo = archivo.mimeType || "";

                const clave =
                    archivo.name + "|" +
                    datos.size + "|" +
                    tipo;

                const candidatos =
                    archivosPorClave.get(clave) || [];

                if (candidatos.length > 0) {

                    const local = candidatos.shift();

                    // Se conserva el archivo local.
                    // Solo se registra su ID de Drive.
                    // La coincidencia por nombre,
                    // tamaño y tipo es provisional.

                    local.driveId = archivo.id;
                    local.sincronizacion =
                        "sincronizado";

                    await guardar("archivos", local);

                    idsRegistrados.add(archivo.id);
                    vinculados++;

                    continue;
                }

                const registro = {

                    id: crearId(),

                    nombre: archivo.name,

                    tipo: tipo,

                    carpeta: null,

                    fecha: archivo.createdTime
                        ? Date.parse(archivo.createdTime)
                        : Date.now(),

                    datos: datos,

                    driveId: archivo.id,

                    sincronizacion: "sincronizado"
                };

                await guardar(
                    "archivos",
                    registro
                );

                idsRegistrados.add(archivo.id);

                recuperados++;

            } catch (error) {

                errores++;

                console.error(
                    "Error recuperando:",
                    archivo.name,
                    error
                );
            }
        }

        await mostrarContenido();

        const resumen =
            "Recuperados: " + recuperados +
            "\nYa registrados: " + existentes +
            "\nVinculados: " + vinculados +
            "\nErrores: " + errores;

        console.log(
            "Sincronizacion Google Drive:\n" +
            resumen
        );

        drive.actualizarEstado(
            errores > 0
                ? "Sincronizacion parcial: " +
                  errores + " error(es)"
                : "Google Drive sincronizado"
        );

        if (!automatico || errores > 0) {

            alert(
                "Sincronizacion terminada.\n\n" +
                resumen + "\n\n" +
                "No se eliminaron archivos locales."
            );
        }

    } catch (error) {

        console.error(
            "Error de sincronizacion:",
            error
        );

        drive.actualizarEstado(
            "Error al sincronizar Google Drive"
        );

        alert(
            "No se pudo completar la sincronizacion:\n" +
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

/* ==========================================
   BOTON DE RECUPERACION MANUAL
========================================== */

function iniciarBotonRecuperacion() {

    const menu = $("panelMenuAjustes");

    if (!menu) {
        console.warn(
            "No se encontro el menu de ajustes."
        );
        return;
    }

    if ($("btnRecuperarGoogleDrive")) return;

    const boton = document.createElement(
        "button"
    );

    boton.id = "btnRecuperarGoogleDrive";

    boton.type = "button";

    boton.textContent =
        "Recuperar desde Google Drive";

    boton.addEventListener(
        "click",
        () => recuperarArchivosGoogleDrive(false)
    );

    const botonListar = $("btnListarGoogleDrive");

    if (botonListar) {
        botonListar.after(boton);
    } else {
        menu.appendChild(boton);
    }
}

/* ==========================================
   RECUPERACION AUTOMATICA
========================================== */

function iniciarSincronizacionAutomatica() {

    window.addEventListener(
        "miGaleriaDriveConectado",
        async () => {

            console.log(
                "Google Drive conectado. " +
                "Iniciando recuperacion automatica..."
            );

            await recuperarArchivosGoogleDrive(true);
        }
    );
}

/* ==========================================
   INICIAR APLICACION
========================================== */

async function iniciar() {

    try {

        await iniciarDB();

        iniciarEventos();

        iniciarBotonRecuperacion();

        iniciarSincronizacionAutomatica();

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
