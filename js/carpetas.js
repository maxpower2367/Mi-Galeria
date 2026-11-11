
/* ==========================================
   MI GALERIA - CARPETAS
   Archivo: carpetas.js

   Portadas seleccionadas desde imagenes
   existentes dentro de cada carpeta.
========================================== */

/* ==========================================
   CREAR CARPETAS
========================================== */

async function nuevaCarpeta() {

    const nombre = prompt("Nombre de la nueva carpeta:");

    if (!nombre || !nombre.trim()) return;

    try {

        const carpetas = await obtenerTodos("carpetas");

        const repetida = carpetas.some(c =>
            c.padre === carpetaActual &&
            c.nombre.toLowerCase() === nombre.trim().toLowerCase()
        );

        if (repetida) {
            alert("Ya existe una carpeta con ese nombre.");
            return;
        }

        await guardar("carpetas", {
            id: crearId(),
            nombre: nombre.trim(),
            padre: carpetaActual,
            fecha: Date.now()
        });

        await mostrarContenido();

    } catch (error) {
        mostrarError(error);
    }
}

/* ==========================================
   HISTORIAL DE NAVEGACION
========================================== */

const CLAVE_HISTORIAL_GALERIA = "miGaleriaCarpetaV1";

(function prepararHistorialGaleria() {

    const estado = history.state;

    if (
        !estado ||
        estado.miGaleria !== CLAVE_HISTORIAL_GALERIA
    ) {

        history.replaceState({
            miGaleria: CLAVE_HISTORIAL_GALERIA,
            carpeta: null
        }, "", location.href);
    }
})();

async function navegar(id, opciones = {}) {

    const destino = id == null ? null : id;

    const desdeHistorial =
        opciones.desdeHistorial === true;

    const cambio = carpetaActual !== destino;

    cerrarVisor();
    cerrarMenu();

    carpetaActual = destino;

    seleccionados.clear();

    busquedaActual = "";

    $("buscador").value = "";

    if (!desdeHistorial && cambio) {

        history.pushState({
            miGaleria: CLAVE_HISTORIAL_GALERIA,
            carpeta: destino
        }, "", location.href);
    }

    await mostrarContenido();
}

window.addEventListener("popstate", async evento => {

    const estado = evento.state;

    const destino =
        estado &&
        estado.miGaleria === CLAVE_HISTORIAL_GALERIA
            ? estado.carpeta ?? null
            : null;

    try {

        if (destino !== null) {

            const carpetas = await obtenerTodos("carpetas");

            if (!carpetas.some(c => c.id === destino)) {

                await navegar(null, {
                    desdeHistorial: true
                });

                return;
            }
        }

        await navegar(destino, {
            desdeHistorial: true
        });

    } catch (error) {

        console.error(
            "No se pudo recuperar la carpeta:",
            error
        );

        mostrarError(error);
    }
});

/* ==========================================
   MOSTRAR RUTA
========================================== */

function mostrarRuta(carpetas) {

    const ruta = $("ruta");

    ruta.innerHTML = "";

    const inicio = document.createElement("button");

    inicio.textContent = "Inicio";

    inicio.onclick = () => navegar(null);

    ruta.appendChild(inicio);

    let actual = carpetas.find(
        c => c.id === carpetaActual
    );

    const camino = [];

    const visitados = new Set();

    while (actual && !visitados.has(actual.id)) {

        visitados.add(actual.id);

        camino.unshift(actual);

        actual = carpetas.find(
            c => c.id === actual.padre
        );
    }

    camino.forEach(carpeta => {

        const separador = document.createElement("span");

        separador.textContent = "›";

        ruta.appendChild(separador);

        const boton = document.createElement("button");

        boton.textContent = carpeta.nombre;

        boton.onclick = () => navegar(carpeta.id);

        ruta.appendChild(boton);
    });
}

/* ==========================================
   ARBOL LATERAL
========================================== */

const CLAVE_ARBOL = "miGaleriaArbolExpandido";

let carpetasExpandidas = new Set();

try {

    carpetasExpandidas = new Set(
        JSON.parse(
            localStorage.getItem(CLAVE_ARBOL) || "[]"
        )
    );

} catch (_) {

    carpetasExpandidas = new Set();
}

function guardarEstadoArbol() {

    try {

        localStorage.setItem(
            CLAVE_ARBOL,
            JSON.stringify([...carpetasExpandidas])
        );

    } catch (error) {

        console.warn(
            "No se pudo guardar el estado del arbol",
            error
        );
    }
}

function mostrarArbol(carpetas) {

    const arbol = $("arbolCarpetas");

    arbol.innerHTML = "";

    const porPadre = new Map();

    carpetas.forEach(c => {

        const lista = porPadre.get(c.padre) || [];

        lista.push(c);

        porPadre.set(c.padre, lista);
    });

    porPadre.forEach(lista => {

        lista.sort((a, b) =>
            a.nombre.localeCompare(b.nombre)
        );
    });

    const porId = new Map(
        carpetas.map(c => [c.id, c])
    );

    const visitadosRuta = new Set();

    let actual = porId.get(carpetaActual);

    while (actual && !visitadosRuta.has(actual.id)) {

        visitadosRuta.add(actual.id);

        if (actual.padre != null) {
            carpetasExpandidas.add(actual.padre);
        }

        actual = porId.get(actual.padre);
    }

    guardarEstadoArbol();

    function crearNivel(padre, destino, visitados) {

        (porPadre.get(padre) || []).forEach(carpeta => {

            if (visitados.has(carpeta.id)) return;

            const hijos =
                (porPadre.get(carpeta.id) || []).length > 0;

            const abierto =
                carpetasExpandidas.has(carpeta.id);

            const grupo = document.createElement("div");

            grupo.className = "arbol-grupo";

            const fila = document.createElement("div");

            fila.className = "arbol-fila";

            const expandir = document.createElement("button");

            expandir.type = "button";

            expandir.className = "arbol-expandir";

            expandir.textContent = hijos
                ? (abierto ? "▾" : "▸")
                : "";

            expandir.disabled = !hijos;

            expandir.title = abierto
                ? "Contraer subcarpetas"
                : "Expandir subcarpetas";

            expandir.setAttribute(
                "aria-label",
                expandir.title
            );

            expandir.setAttribute(
                "aria-expanded",
                String(abierto)
            );

            expandir.onclick = () => {

                if (carpetasExpandidas.has(carpeta.id)) {

                    carpetasExpandidas.delete(carpeta.id);

                } else {

                    carpetasExpandidas.add(carpeta.id);
                }

                guardarEstadoArbol();

                mostrarArbol(carpetas);
            };

            const boton = document.createElement("button");

            boton.type = "button";

            boton.className = "arbol-item";

            if (carpeta.id === carpetaActual) {
                boton.classList.add("activo");
            }

            const icono = document.createElement("span");

            icono.className = "arbol-icono";

            icono.textContent = "📁";

            const nombre = document.createElement("span");

            nombre.className = "arbol-texto";

            nombre.textContent = carpeta.nombre;

            boton.append(icono, nombre);

            boton.title = carpeta.nombre;

            boton.onclick = () => navegar(carpeta.id);

            fila.append(expandir, boton);

            grupo.appendChild(fila);

            if (hijos && abierto) {

                const subnivel = document.createElement("div");

                subnivel.className = "arbol-subnivel";

                const siguientes = new Set(visitados);

                siguientes.add(carpeta.id);

                crearNivel(
                    carpeta.id,
                    subnivel,
                    siguientes
                );

                grupo.appendChild(subnivel);
            }

            destino.appendChild(grupo);
        });
    }

    crearNivel(null, arbol, new Set());
}

/* ==========================================
   SELECTOR DE PORTADAS
========================================== */

let selectorPortadaAbierto = false;

/*
   La portada se guarda mediante portadaArchivoId.

   No se duplica la imagen.
   Se utiliza el archivo original de IndexedDB.
*/

async function cambiarPortadaCarpeta(carpeta) {

    if (selectorPortadaAbierto) return;

    try {

        const archivos = await obtenerTodos("archivos");

        const imagenes = archivos
            .filter(archivo =>
                archivo.carpeta === carpeta.id &&
                typeof archivo.tipo === "string" &&
                archivo.tipo.startsWith("image/")
            )
            .sort((a, b) =>
                (b.fecha || 0) - (a.fecha || 0)
            );

        if (imagenes.length === 0) {

            alert(
                "Esta carpeta no contiene imagenes.\n\n" +
                "Primero sube una imagen dentro de " +
                "esta carpeta para usarla como portada."
            );

            return;
        }

        selectorPortadaAbierto = true;

        const urlsTemporales = [];

        const fondo = document.createElement("div");

        fondo.id = "selectorPortadaGaleria";

        Object.assign(fondo.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.85)",
            zIndex: "99999",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box"
        });

        const ventana = document.createElement("div");

        Object.assign(ventana.style, {
            background: "#202020",
            color: "#ffffff",
            width: "min(900px, 100%)",
            maxHeight: "85vh",
            overflow: "hidden",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
        });

        const encabezado = document.createElement("div");

        Object.assign(encabezado.style, {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "18px",
            borderBottom: "1px solid #444"
        });

        const titulo = document.createElement("div");

        const textoTitulo = document.createElement("h3");

        textoTitulo.textContent = "Seleccionar portada";

        textoTitulo.style.margin = "0 0 5px";

        const subtitulo = document.createElement("div");

        subtitulo.textContent =
            carpeta.nombre + " - " +
            imagenes.length + " imagen(es)";

        subtitulo.style.fontSize = "13px";

        subtitulo.style.color = "#aaaaaa";

        titulo.append(textoTitulo, subtitulo);

        const cerrar = document.createElement("button");

        cerrar.type = "button";

        cerrar.textContent = "✕";

        Object.assign(cerrar.style, {
            background: "#383838",
            color: "white",
            border: "none",
            borderRadius: "7px",
            padding: "9px 13px",
            cursor: "pointer"
        });

        encabezado.append(titulo, cerrar);

        const cuadricula = document.createElement("div");

        Object.assign(cuadricula.style, {
            display: "grid",
            gridTemplateColumns:
                "repeat(auto-fill, minmax(125px, 1fr))",
            gap: "12px",
            padding: "18px",
            overflowY: "auto"
        });

        const pie = document.createElement("div");

        Object.assign(pie.style, {
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "14px 18px",
            borderTop: "1px solid #444"
        });

        const cancelar = document.createElement("button");

        cancelar.type = "button";

        cancelar.textContent = "Cancelar";

        Object.assign(cancelar.style, {
            background: "#444",
            color: "#fff",
            border: "none",
            borderRadius: "7px",
            padding: "10px 16px",
            cursor: "pointer"
        });

        const seleccionar = document.createElement("button");

        seleccionar.type = "button";

        seleccionar.textContent = "Establecer portada";

        seleccionar.disabled = true;

        Object.assign(seleccionar.style, {
            background: "#2878d0",
            color: "#fff",
            border: "none",
            borderRadius: "7px",
            padding: "10px 16px",
            cursor: "pointer",
            opacity: "0.5"
        });

        pie.append(cancelar, seleccionar);

        ventana.append(encabezado, cuadricula, pie);

        fondo.appendChild(ventana);

        document.body.appendChild(fondo);

        let imagenSeleccionada = null;

        let guardando = false;

        function cerrarSelector() {

            if (guardando) return;

            urlsTemporales.forEach(url => {
                URL.revokeObjectURL(url);
            });

            fondo.remove();

            document.removeEventListener(
                "keydown",
                manejarTeclado
            );

            selectorPortadaAbierto = false;
        }

        function manejarTeclado(evento) {

            if (evento.key === "Escape") {
                cerrarSelector();
            }
        }

        document.addEventListener(
            "keydown",
            manejarTeclado
        );

        cerrar.onclick = cerrarSelector;

        cancelar.onclick = cerrarSelector;

        fondo.onclick = evento => {

            if (evento.target === fondo) {
                cerrarSelector();
            }
        };

        imagenes.forEach(archivo => {

            const tarjeta = document.createElement("button");

            tarjeta.type = "button";

            tarjeta.title = archivo.nombre;

            Object.assign(tarjeta.style, {
                background: "#303030",
                border: "2px solid transparent",
                borderRadius: "9px",
                overflow: "hidden",
                padding: "0",
                cursor: "pointer",
                color: "#fff",
                textAlign: "left"
            });

            const imagen = document.createElement("img");

            Object.assign(imagen.style, {
                width: "100%",
                height: "120px",
                objectFit: "cover",
                display: "block",
                background: "#161616"
            });

            imagen.alt = archivo.nombre;

            imagen.loading = "lazy";

            if (archivo.datos instanceof Blob) {

                const url = URL.createObjectURL(
                    archivo.datos
                );

                urlsTemporales.push(url);

                imagen.src = url;

            } else {

                imagen.alt = "Imagen no disponible localmente";
            }

            const nombre = document.createElement("div");

            nombre.textContent = archivo.nombre;

            Object.assign(nombre.style, {
                fontSize: "12px",
                padding: "8px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            });

            tarjeta.append(imagen, nombre);

            if (!(archivo.datos instanceof Blob)) {

                tarjeta.disabled = true;

                tarjeta.title =
                    "Esta imagen aun no esta disponible localmente";

                tarjeta.style.opacity = "0.4";
            }

            tarjeta.onclick = () => {

                imagenSeleccionada = archivo;

                cuadricula.querySelectorAll("button")
                    .forEach(boton => {

                        boton.style.borderColor = "transparent";
                    });

                tarjeta.style.borderColor = "#3995ff";

                seleccionar.disabled = false;

                seleccionar.style.opacity = "1";
            };

            cuadricula.appendChild(tarjeta);
        });

        seleccionar.onclick = async () => {

            if (!imagenSeleccionada || guardando) return;

            guardando = true;

            seleccionar.disabled = true;

            seleccionar.textContent = "Guardando...";

            try {

                const carpetas = await obtenerTodos("carpetas");

                const actual = carpetas.find(
                    c => c.id === carpeta.id
                );

                if (!actual) {

                    throw new Error(
                        "La carpeta ya no existe."
                    );
                }

                const archivosActuales =
                    await obtenerTodos("archivos");

                const imagenActual =
                    archivosActuales.find(a =>
                        a.id === imagenSeleccionada.id &&
                        a.carpeta === carpeta.id &&
                        typeof a.tipo === "string" &&
                        a.tipo.startsWith("image/")
                    );

                if (!imagenActual) {

                    throw new Error(
                        "La imagen seleccionada ya no " +
                        "esta dentro de esta carpeta."
                    );
                }

                actual.portadaArchivoId = imagenActual.id;

                actual.portadaSinImagen = false;

                delete actual.portadaPersonalizada;

                await guardar("carpetas", actual);

                guardando = false;

                cerrarSelector();

                await mostrarContenido();

            } catch (error) {

                guardando = false;

                seleccionar.disabled = false;

                seleccionar.textContent =
                    "Establecer portada";

                mostrarError(error);
            }
        };

    } catch (error) {

        selectorPortadaAbierto = false;

        mostrarError(error);
    }
}

/* ==========================================
   QUITAR PORTADA
========================================== */

async function quitarPortadaCarpeta(carpeta) {

    try {

        const actual = (
            await obtenerTodos("carpetas")
        ).find(c => c.id === carpeta.id);

        if (!actual) return;

        delete actual.portadaArchivoId;

        delete actual.portadaPersonalizada;

        actual.portadaSinImagen = true;

        await guardar("carpetas", actual);

        await mostrarContenido();

    } catch (error) {

        mostrarError(error);
    }
}

/* ==========================================
   PORTADA AUTOMATICA
========================================== */

function obtenerPortada(carpetaId, archivos) {

    return archivos
        .filter(archivo =>
            archivo.carpeta === carpetaId &&
            typeof archivo.tipo === "string" &&
            archivo.tipo.startsWith("image/")
        )
        .sort((a, b) =>
            (b.fecha || 0) - (a.fecha || 0)
        )[0] || null;
}

/* ==========================================
   MOSTRAR CARPETAS
========================================== */

function mostrarCarpetas(carpetas, archivos) {

    const contenedor = $("carpetas");

    contenedor.innerHTML = "";

    const hijas = ordenarElementos(
        carpetas.filter(c =>
            c.padre === carpetaActual &&
            coincideBusqueda(c.nombre)
        )
    );

    $("seccionCarpetas").classList.toggle(
        "oculto",
        hijas.length === 0
    );

    hijas.forEach(carpeta => {

        const elemento = document.createElement("div");

        elemento.className = "carpeta";

        const portada = document.createElement("div");

        portada.className = "carpeta-portada";

        let archivoPortada = null;

        if (!carpeta.portadaSinImagen) {

            /* PORTADA ELEGIDA POR EL USUARIO */

            if (carpeta.portadaArchivoId) {

                const seleccionada = archivos.find(
                    archivo =>
                        archivo.id === carpeta.portadaArchivoId &&
                        archivo.carpeta === carpeta.id &&
                        typeof archivo.tipo === "string" &&
                        archivo.tipo.startsWith("image/")
                );

                if (
                    seleccionada &&
                    seleccionada.datos instanceof Blob
                ) {

                    archivoPortada = seleccionada.datos;
                }
            }

            /* PORTADA ANTIGUA, SI EXISTE */

            if (
                !archivoPortada &&
                !carpeta.portadaArchivoId &&
                carpeta.portadaPersonalizada instanceof Blob
            ) {

                archivoPortada =
                    carpeta.portadaPersonalizada;
            }

            /* PORTADA AUTOMATICA */

            if (
                !archivoPortada &&
                !carpeta.portadaArchivoId &&
                !(
                    carpeta.portadaPersonalizada instanceof Blob
                )
            ) {

                const automatica = obtenerPortada(
                    carpeta.id,
                    archivos
                );

                if (
                    automatica &&
                    automatica.datos instanceof Blob
                ) {

                    archivoPortada = automatica.datos;
                }
            }
        }

        if (archivoPortada instanceof Blob) {

            const img = document.createElement("img");

            const url = URL.createObjectURL(
                archivoPortada
            );

            urlsMiniaturas.push(url);

            img.src = url;

            img.alt = "Portada de " + carpeta.nombre;

            img.loading = "lazy";

            portada.appendChild(img);

            const insignia = document.createElement("span");

            insignia.className = "carpeta-insignia";

            insignia.textContent = "📁";

            insignia.setAttribute(
                "aria-label",
                "Carpeta"
            );

            portada.appendChild(insignia);

        } else {

            const icono = document.createElement("span");

            icono.className = "carpeta-icono";

            icono.textContent = "📁";

            portada.appendChild(icono);
        }

        const pie = document.createElement("div");

        pie.className = "carpeta-pie";

        const nombre = document.createElement("span");

        nombre.className = "carpeta-nombre";

        nombre.textContent = carpeta.nombre;

        const menu = crearBotonMenu(
            "carpeta",
            carpeta
        );

        pie.appendChild(nombre);

        pie.appendChild(menu);

        elemento.appendChild(portada);

        elemento.appendChild(pie);

        elemento.onclick = () => navegar(carpeta.id);

        contenedor.appendChild(elemento);
    });
}

/* ==========================================
   OBTENER SUBCARPETAS DESCENDIENTES
========================================== */

function obtenerDescendientes(id, carpetas) {

    const resultado = new Set([id]);

    const pendientes = [id];

    while (pendientes.length > 0) {

        const actual = pendientes.pop();

        carpetas
            .filter(c => c.padre === actual)
            .forEach(c => {

                if (!resultado.has(c.id)) {

                    resultado.add(c.id);

                    pendientes.push(c.id);
                }
            });
    }

    return resultado;
}

/* ==========================================
   COMPROBAR NOMBRE DE CARPETA
========================================== */

async function nombreCarpetaDisponible(
    nombre,
    padre,
    ignorarId = null
) {

    const carpetas = await obtenerTodos("carpetas");

    return !carpetas.some(c =>
        c.id !== ignorarId &&
        c.padre === padre &&
        c.nombre.toLowerCase() === nombre.toLowerCase()
    );
}

/* ==========================================
   RENOMBRAR CARPETA
========================================== */

async function renombrarCarpeta(carpeta) {

    const nombre = prompt(
        "Nuevo nombre de la carpeta:",
        carpeta.nombre
    );

    if (!nombre || !nombre.trim()) return;

    const nuevoNombre = nombre.trim();

    try {

        const disponible = await nombreCarpetaDisponible(
            nuevoNombre,
            carpeta.padre,
            carpeta.id
        );

        if (!disponible) {

            alert(
                "Ya existe una carpeta con ese nombre."
            );

            return;
        }

        carpeta.nombre = nuevoNombre;

        await guardar("carpetas", carpeta);

        await mostrarContenido();

    } catch (error) {

        mostrarError(error);
    }
}

/* ==========================================
   MOVER CARPETA
========================================== */

async function moverCarpeta(carpeta) {

    try {

        const carpetas = await obtenerTodos("carpetas");

        const prohibidas = obtenerDescendientes(
            carpeta.id,
            carpetas
        );

        const resultado = await elegirDestino(
            prohibidas
        );

        if (resultado.cancelado) return;

        const disponible = await nombreCarpetaDisponible(
            carpeta.nombre,
            resultado.destino,
            carpeta.id
        );

        if (!disponible) {

            alert(
                "Ya existe una carpeta con ese nombre en el destino."
            );

            return;
        }

        carpeta.padre = resultado.destino;

        await guardar("carpetas", carpeta);

        await mostrarContenido();

    } catch (error) {

        mostrarError(error);
    }
}

/* ==========================================
   ELIMINAR CARPETA Y SU CONTENIDO
========================================== */

async function eliminarCarpetaCompleta(id) {

    const carpetas = await obtenerTodos("carpetas");

    const archivos = await obtenerTodos("archivos");

    const ids = obtenerDescendientes(
        id,
        carpetas
    );

    await ejecutarTransaccion(
        ["carpetas", "archivos"],
        tx => {

            const storeCarpetas =
                tx.objectStore("carpetas");

            const storeArchivos =
                tx.objectStore("archivos");

            archivos.forEach(archivo => {

                if (ids.has(archivo.carpeta)) {

                    storeArchivos.delete(
                        archivo.id
                    );
                }
            });

            ids.forEach(carpetaId => {

                storeCarpetas.delete(
                    carpetaId
                );
            });
        }
    );
}
