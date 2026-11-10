
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
   RECUPERAR ARCHIVOS DESDE GOOGLE DRIVE
========================================== */

let recuperacionEnProceso = false;

async function recuperarArchivosGoogleDrive() {

    if (recuperacionEnProceso) return;

    const drive = window.MiGaleriaGoogleDrive;

    if (!drive || !drive.disponible()) {

        alert(
            "Primero debes conectar Google Drive."
        );

        return;
    }

    const confirmar = confirm(
        "Se consultaran los archivos de Google Drive " +
        "y se descargaran los que no esten registrados " +
        "localmente.\n\n" +
        "No se eliminaran archivos locales.\n\n" +
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
    let errores = 0;

    try {

        const archivosDrive =
            await drive.listarArchivos();

        const archivosLocales =
            await obtenerTodos("archivos");

        const idsRegistrados = new Set(
            archivosLocales
                .filter(a => a.driveId)
                .map(a => a.driveId)
        );

        const nombresLocales = new Set(
            archivosLocales.map(a =>
                a.nombre + "|" +
                (a.datos?.size ?? "") + "|" +
                (a.tipo || "")
            )
        );

        for (const archivo of archivosDrive) {

            const tipo = archivo.mimeType || "";

            if (
                !tipo.startsWith("image/") &&
                !tipo.startsWith("video/")
            ) {
                continue;
            }

            if (idsRegistrados.has(archivo.id)) {
                existentes++;
                continue;
            }

            try {

                const datos =
                    await drive.descargarArchivo(
                        archivo.id
                    );

                const clave =
                    archivo.name + "|" +
                    datos.size + "|" +
                    tipo;

                if (nombresLocales.has(clave)) {
                    existentes++;
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

                await guardar("archivos", registro);

                idsRegistrados.add(archivo.id);
                nombresLocales.add(clave);

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

        alert(
            "Recuperacion terminada.\n\n" +
            "Archivos recuperados: " +
            recuperados + "\n" +
            "Archivos existentes: " +
            existentes + "\n" +
            "Errores: " + errores + "\n\n" +
            "Los archivos locales se conservaron."
        );

    } catch (error) {

        console.error(
            "Error consultando Google Drive:",
            error
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

/* ==========================================
   BOTON DE RECUPERACION
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

    const boton = document.createElement("button");

    boton.id = "btnRecuperarGoogleDrive";
    boton.type = "button";
    boton.textContent =
        "Recuperar desde Google Drive";

    boton.addEventListener(
        "click",
        recuperarArchivosGoogleDrive
    );

    const botonListar = $("btnListarGoogleDrive");

    if (botonListar) {
        botonListar.after(boton);
    } else {
        menu.appendChild(boton);
    }
}

/* ==========================================
   INICIAR APLICACION
========================================== */

async function iniciar() {

    try {

        await iniciarDB();

        iniciarEventos();

        iniciarBotonRecuperacion();

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
