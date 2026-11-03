
/* ==========================================
   MI GALERIA - MODALES
   Archivo: modales.js
========================================== */

let archivosPendientes = [];
let subidaEnProceso = false;

function abrirModal(id) {
    $(id).classList.remove("oculto");
}

function cerrarModal(id) {
    $(id).classList.add("oculto");
}

/* ==========================================
   NUEVA CARPETA
========================================== */

function abrirModalCarpeta() {
    $("nombreNuevaCarpeta").value = "";
    abrirModal("modalCarpeta");
    $("nombreNuevaCarpeta").focus();
}

function cerrarModalCarpeta() {
    cerrarModal("modalCarpeta");
}

async function crearCarpetaDesdeModal(evento) {
    evento.preventDefault();

    const nombre = $("nombreNuevaCarpeta").value.trim();

    if (!nombre) return;

    try {
        const carpetas = await obtenerTodos("carpetas");

        const repetida = carpetas.some(c =>
            c.padre === carpetaActual &&
            c.nombre.toLowerCase() === nombre.toLowerCase()
        );

        if (repetida) {
            alert("Ya existe una carpeta con ese nombre.");
            return;
        }

        await guardar("carpetas", {
            id: crearId(),
            nombre,
            padre: carpetaActual,
            fecha: Date.now()
        });

        cerrarModalCarpeta();
        await mostrarContenido();

    } catch (error) {
        mostrarError(error);
    }
}

/* ==========================================
   SUBIR ARCHIVOS
========================================== */

function abrirModalSubida() {
    if (subidaEnProceso) return;

    archivosPendientes = [];
    $("subirArchivos").value = "";
    $("estadoSubida").textContent = "";

    actualizarListaSubida();
    abrirModal("modalSubida");
}

function cerrarModalSubida() {
    if (subidaEnProceso) return;

    archivosPendientes = [];
    $("subirArchivos").value = "";
    cerrarModal("modalSubida");
}

function agregarArchivosPendientes(archivos) {
    if (subidaEnProceso) return;

    const nuevos = Array.from(archivos).filter(archivo =>
        archivo.type.startsWith("image/") ||
        archivo.type.startsWith("video/")
    );

    for (const archivo of nuevos) {
        const repetido = archivosPendientes.some(a =>
            a.name === archivo.name &&
            a.size === archivo.size &&
            a.lastModified === archivo.lastModified
        );

        if (!repetido) {
            archivosPendientes.push(archivo);
        }
    }

    actualizarListaSubida();
}

function actualizarListaSubida() {
    const lista = $("listaArchivosSubida");

    lista.innerHTML = "";

    archivosPendientes.forEach((archivo, indice) => {
        const fila = document.createElement("div");
        fila.className = "archivo-pendiente";

        const nombre = document.createElement("span");
        nombre.textContent = archivo.name;
        nombre.title = archivo.name;

        const quitar = document.createElement("button");
        quitar.type = "button";
        quitar.textContent = "✕";
        quitar.title = "Quitar archivo";
        quitar.disabled = subidaEnProceso;

        quitar.onclick = () => {
            archivosPendientes.splice(indice, 1);
            actualizarListaSubida();
        };

        fila.append(nombre, quitar);
        lista.appendChild(fila);
    });

    $("confirmarSubida").disabled =
        subidaEnProceso || archivosPendientes.length === 0;

    $("confirmarSubida").textContent =
        archivosPendientes.length > 0
            ? `Subir ${archivosPendientes.length} archivo(s)`
            : "Subir archivos";
}

/* ==========================================
   GUARDAR EN INDEXEDDB Y GOOGLE DRIVE
========================================== */

async function confirmarArchivosSubida() {

    if (
        subidaEnProceso ||
        archivosPendientes.length === 0
    ) {
        return;
    }

    subidaEnProceso = true;

    const archivos = [...archivosPendientes];
    const destino = carpetaActual;

    $("confirmarSubida").disabled = true;
    $("cancelarModalSubida").disabled = true;
    $("cerrarModalSubida").disabled = true;
    $("btnSeleccionarArchivos").disabled = true;

    let guardados = 0;
    let sincronizados = 0;
    let pendientes = 0;

    const errores = [];

    try {

        for (const archivo of archivos) {

            $("estadoSubida").textContent =
                `Guardando ${guardados + 1} de ${archivos.length}...`;

            const registro = {
                id: crearId(),
                nombre: archivo.name,
                tipo: archivo.type,
                carpeta: destino,
                fecha: Date.now(),
                datos: archivo,

                driveId: null,
                sincronizacion: "pendiente"
            };

            // ==================================
            // GUARDAR EN INDEXEDDB
            // ==================================

            await guardar("archivos", registro);

            guardados++;

            // Retirar el archivo de la lista pendiente
            // para evitar duplicados si falla otro.

            archivosPendientes.shift();

            // ==================================
            // SUBIR A GOOGLE DRIVE
            // ==================================

            const drive = window.MiGaleriaGoogleDrive;

            if (!drive || !drive.disponible()) {

                pendientes++;

                $("estadoSubida").textContent =
                    "Google Drive desconectado. " +
                    "Archivo guardado localmente.";

                continue;
            }

            try {

                $("estadoSubida").textContent =
                    `Subiendo a Google Drive: ${archivo.name}`;

                const resultado =
                    await drive.subirArchivo(archivo);

                // Guardar el ID del archivo
                // que Google Drive ha devuelto.

                registro.driveId = resultado.id;
                registro.sincronizacion = "sincronizado";

                try {

                    await guardar("archivos", registro);

                    sincronizados++;

                } catch (errorLocal) {

                    // El archivo ya llego a Drive.
                    // No repetir la subida automaticamente.

                    pendientes++;

                    errores.push(
                        archivo.name +
                        ": subido a Drive, pero no " +
                        "se pudo registrar su ID local."
                    );

                    console.error(
                        "Error al registrar ID de Drive:",
                        resultado.id,
                        errorLocal
                    );
                }

            } catch (error) {

                pendientes++;

                errores.push(
                    archivo.name + ": " + error.message
                );

                console.error(
                    "Error al subir a Google Drive:",
                    error
                );
            }
        }

        // ==================================
        // ACTUALIZAR LA GALERIA
        // ==================================

        await mostrarContenido();

        // ==================================
        // MOSTRAR RESULTADO
        // ==================================

        let mensaje =
            "Resultado de la subida:\n\n" +
            "Guardados localmente: " + guardados + "\n" +
            "Subidos y registrados en Google Drive: " +
            sincronizados + "\n" +
            "Pendientes o sin confirmar: " + pendientes;

        if (errores.length > 0) {

            mensaje +=
                "\n\nDetalles:\n" +
                errores.slice(0, 5).join("\n");
        }

        if (pendientes > 0) {

            mensaje +=
                "\n\nLos archivos locales se conservan." +
                "\nLos pendientes aun no se reintentan " +
                "automaticamente.";
        }

        $("estadoSubida").textContent =
            `${guardados} guardados localmente, ` +
            `${sincronizados} subidos a Drive, ` +
            `${pendientes} pendientes.`;

        alert(mensaje);

        if (archivosPendientes.length === 0) {
            $("subirArchivos").value = "";
            cerrarModal("modalSubida");
        }

    } catch (error) {

        console.error(
            "Error durante la subida:",
            error
        );

        mostrarError(error);

        $("estadoSubida").textContent =
            `Se guardaron ${guardados} de ${archivos.length} ` +
            "archivos localmente. " +
            "Puedes reintentar los restantes.";

    } finally {

        subidaEnProceso = false;

        $("cancelarModalSubida").disabled = false;
        $("cerrarModalSubida").disabled = false;
        $("btnSeleccionarArchivos").disabled = false;

        actualizarListaSubida();
    }
}

/* ==========================================
   EVENTOS
========================================== */

function iniciarEventosModales() {

    $("btnNuevaCarpeta").addEventListener(
        "click",
        abrirModalCarpeta
    );

    $("cerrarModalCarpeta").addEventListener(
        "click",
        cerrarModalCarpeta
    );

    $("cancelarModalCarpeta").addEventListener(
        "click",
        cerrarModalCarpeta
    );

    $("formNuevaCarpeta").addEventListener(
        "submit",
        crearCarpetaDesdeModal
    );

    $("btnAbrirSubida").addEventListener(
        "click",
        abrirModalSubida
    );

    $("cerrarModalSubida").addEventListener(
        "click",
        cerrarModalSubida
    );

    $("cancelarModalSubida").addEventListener(
        "click",
        cerrarModalSubida
    );

    $("btnSeleccionarArchivos").addEventListener(
        "click",
        () => $("subirArchivos").click()
    );

    $("subirArchivos").addEventListener(
        "change",
        evento => {
            agregarArchivosPendientes(evento.target.files);
            evento.target.value = "";
        }
    );

    $("confirmarSubida").addEventListener(
        "click",
        confirmarArchivosSubida
    );

    const zona = $("zonaArrastre");

    zona.addEventListener("dragover", evento => {
        evento.preventDefault();
        zona.classList.add("arrastrando-archivo");
    });

    zona.addEventListener("dragleave", evento => {
        if (!zona.contains(evento.relatedTarget)) {
            zona.classList.remove("arrastrando-archivo");
        }
    });

    zona.addEventListener("drop", evento => {
        evento.preventDefault();
        zona.classList.remove("arrastrando-archivo");
        agregarArchivosPendientes(evento.dataTransfer.files);
    });

    ["modalCarpeta", "modalSubida"].forEach(id => {
        $(id).addEventListener("click", evento => {
            if (evento.target !== $(id)) return;

            if (id === "modalCarpeta") {
                cerrarModalCarpeta();
            } else {
                cerrarModalSubida();
            }
        });
    });
}
