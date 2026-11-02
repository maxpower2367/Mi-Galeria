
/* ==========================================
   MI GALERIA - ESTADISTICAS
   Archivo: estadisticas.js
========================================== */

(function () {

    "use strict";

    const CLAVE = "MiGaleriaComparativasV1";

    let comparativas = [];
    let comparativaActual = null;
    let carpetasDisponibles = [];
    let seleccionCarpetas = new Set();

    const $e = id => document.getElementById(id);

    function escapar(texto) {
        return String(texto).replace(/[&<>"']/g, caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caracter]);
    }

    function generarId() {
        return "comp-" + Date.now() + "-" +
            Math.random().toString(36).slice(2);
    }

    function cargarComparativas() {
        try {
            const datos = JSON.parse(
                localStorage.getItem(CLAVE) || "[]"
            );

            comparativas = Array.isArray(datos)
                ? datos
                : [];

        } catch (error) {
            console.error(error);
            comparativas = [];
        }
    }

    function guardarComparativas() {
        try {
            localStorage.setItem(
                CLAVE,
                JSON.stringify(comparativas)
            );
            return true;
        } catch (error) {
            alert("No se pudieron guardar las comparativas.");
            console.error(error);
            return false;
        }
    }

    function mostrarPanel() {
        $e("panelEstadisticas").classList.remove("oculto");
        document.body.style.overflow = "hidden";
        mostrarLista();
    }

    function cerrarPanel() {
        $e("panelEstadisticas").classList.add("oculto");
        $e("formComparativa").classList.add("oculto");
        document.body.style.overflow = "";
    }

    function mostrarLista() {

        comparativaActual = null;

        $e("listaComparativas").classList.remove("oculto");
        $e("detalleComparativa").classList.add("oculto");
        $e("formComparativa").classList.add("oculto");

        const lista = $e("contenedorComparativas");
        lista.innerHTML = "";

        if (!comparativas.length) {
            lista.innerHTML = `
                <div class="estad-vacio">
                    Todavía no has creado comparativas.
                    <p>Presiona "Nueva comparativa" para comenzar.</p>
                </div>
            `;
            return;
        }

        comparativas.forEach(comparativa => {

            const tarjeta = document.createElement("div");
            tarjeta.className = "estad-tarjeta";

            const titulo = document.createElement("div");
            titulo.className = "estad-tarjeta-info";

            titulo.innerHTML = `
                <strong>${escapar(comparativa.nombre)}</strong>
                <span>
                    ${comparativa.carpetas.length}
                    carpeta(s) seleccionada(s)
                </span>
            `;

            const acciones = document.createElement("div");
            acciones.className = "estad-acciones";

            const abrir = crearBoton("Ver", () => {
                abrirComparativa(comparativa.id);
            });

            const editar = crearBoton("Editar", () => {
                abrirFormulario(comparativa.id);
            });

            const eliminar = crearBoton("Eliminar", () => {
                eliminarComparativa(comparativa.id);
            });

            eliminar.classList.add("estad-peligro");

            acciones.append(abrir, editar, eliminar);
            tarjeta.append(titulo, acciones);
            lista.appendChild(tarjeta);
        });
    }

    function crearBoton(texto, accion) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = texto;
        boton.addEventListener("click", accion);
        return boton;
    }

    async function abrirFormulario(id = null) {

        const comparativa = comparativas.find(c => c.id === id);

        try {
            carpetasDisponibles = await obtenerTodos("carpetas");
        } catch (error) {
            alert("No se pudieron cargar las carpetas.");
            console.error(error);
            return;
        }

        comparativaActual = id;

        seleccionCarpetas = new Set(
            comparativa ? comparativa.carpetas : []
        );

        $e("tituloFormComparativa").textContent =
            comparativa ? "Editar comparativa" : "Nueva comparativa";

        $e("nombreComparativa").value =
            comparativa ? comparativa.nombre : "";

        $e("incluirSubcarpetas").checked =
            comparativa ? Boolean(comparativa.subcarpetas) : false;

        $e("listaComparativas").classList.add("oculto");
        $e("detalleComparativa").classList.add("oculto");
        $e("formComparativa").classList.remove("oculto");

        renderizarSelectorCarpetas();
    }

    function renderizarSelectorCarpetas() {

        const contenedor = $e("selectorCarpetas");
        contenedor.innerHTML = "";

        const filtro = $e("buscarCarpetaComparativa")
            .value.trim().toLowerCase();

        const carpetas = [...carpetasDisponibles].sort(
            (a, b) => a.nombre.localeCompare(b.nombre, "es")
        );

        function rutaCarpeta(carpeta) {

            const partes = [carpeta.nombre];
            const visitados = new Set([carpeta.id]);

            let padre = carpeta.padre;

            while (padre != null && !visitados.has(padre)) {

                const encontrada = carpetasDisponibles.find(
                    c => c.id === padre
                );

                if (!encontrada) break;

                partes.unshift(encontrada.nombre);
                visitados.add(padre);
                padre = encontrada.padre;
            }

            return partes.join(" / ");
        }

        let mostradas = 0;

        carpetas.forEach(carpeta => {

            const ruta = rutaCarpeta(carpeta);

            if (!ruta.toLowerCase().includes(filtro)) {
                return;
            }

            mostradas++;

            const etiqueta = document.createElement("label");
            etiqueta.className = "estad-opcion-carpeta";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = seleccionCarpetas.has(carpeta.id);

            checkbox.addEventListener("change", () => {

                if (checkbox.checked) {
                    seleccionCarpetas.add(carpeta.id);
                } else {
                    seleccionCarpetas.delete(carpeta.id);
                }

                actualizarSeleccionCarpetas();
            });

            const nombre = document.createElement("span");
            nombre.textContent = "📁 " + ruta;

            etiqueta.append(checkbox, nombre);
            contenedor.appendChild(etiqueta);
        });

        if (!mostradas) {
            contenedor.textContent = "No se encontraron carpetas.";
        }

        actualizarSeleccionCarpetas();
    }

    function actualizarSeleccionCarpetas() {
        $e("cantidadCarpetasSeleccionadas").textContent =
            seleccionCarpetas.size + " carpeta(s) seleccionada(s)";
    }

    function guardarFormulario(evento) {

        evento.preventDefault();

        const nombre = $e("nombreComparativa").value.trim();

        if (!nombre) {
            alert("Escribe un nombre para la comparativa.");
            return;
        }

        if (!seleccionCarpetas.size) {
            alert("Selecciona al menos una carpeta.");
            return;
        }

        const datos = {
            id: comparativaActual || generarId(),
            nombre,
            carpetas: [...seleccionCarpetas],
            subcarpetas: $e("incluirSubcarpetas").checked
        };

        const indice = comparativas.findIndex(
            c => c.id === datos.id
        );

        const anteriores = [...comparativas];

        if (indice >= 0) {
            comparativas[indice] = datos;
        } else {
            comparativas.push(datos);
        }

        if (!guardarComparativas()) {
            comparativas = anteriores;
            return;
        }

        $e("buscarCarpetaComparativa").value = "";

        mostrarLista();
    }

    function eliminarComparativa(id) {

        const comparativa = comparativas.find(c => c.id === id);

        if (!comparativa) return;

        if (!confirm(
            `¿Eliminar la comparativa "${comparativa.nombre}"?`
        )) return;

        const anteriores = [...comparativas];

        comparativas = comparativas.filter(c => c.id !== id);

        if (!guardarComparativas()) {
            comparativas = anteriores;
            return;
        }

        mostrarLista();
    }

    function obtenerIdsDescendientes(id, carpetas) {

        const ids = new Set([id]);
        const pendientes = [id];

        while (pendientes.length) {

            const padre = pendientes.pop();

            carpetas.forEach(carpeta => {

                if (
                    carpeta.padre === padre &&
                    !ids.has(carpeta.id)
                ) {
                    ids.add(carpeta.id);
                    pendientes.push(carpeta.id);
                }
            });
        }

        return ids;
    }

    async function abrirComparativa(id) {

        const comparativa = comparativas.find(c => c.id === id);

        if (!comparativa) return;

        comparativaActual = id;

        $e("listaComparativas").classList.add("oculto");
        $e("formComparativa").classList.add("oculto");
        $e("detalleComparativa").classList.remove("oculto");

        $e("tituloDetalleComparativa").textContent =
            comparativa.nombre;

        const contenedor = $e("tablaEstadisticas");
        const grafica = $e("graficaEstadisticas");

        contenedor.textContent = "Calculando...";
        grafica.innerHTML = "";

        try {

            const [carpetas, archivos] = await Promise.all([
                obtenerTodos("carpetas"),
                obtenerTodos("archivos")
            ]);

            const resultados = comparativa.carpetas.map(idCarpeta => {

                const carpeta = carpetas.find(
                    c => c.id === idCarpeta
                );

                if (!carpeta) {
                    return {
                        nombre: "Carpeta no encontrada",
                        cantidad: 0,
                        faltante: true
                    };
                }

                const ids = comparativa.subcarpetas
                    ? obtenerIdsDescendientes(idCarpeta, carpetas)
                    : new Set([idCarpeta]);

                const cantidad = archivos.filter(
                    archivo => ids.has(archivo.carpeta)
                ).length;

                return {
                    nombre: carpeta.nombre,
                    cantidad,
                    faltante: false
                };
            });

            resultados.sort(
                (a, b) =>
                    b.cantidad - a.cantidad ||
                    a.nombre.localeCompare(b.nombre, "es")
            );

            renderizarResultados(resultados, comparativa);

        } catch (error) {

            console.error(error);

            contenedor.textContent =
                "Ocurrió un error al calcular las estadísticas.";
        }
    }

    function renderizarResultados(resultados, comparativa) {

        const tabla = $e("tablaEstadisticas");
        const grafica = $e("graficaEstadisticas");

        tabla.innerHTML = "";
        grafica.innerHTML = "";

        const total = resultados.reduce(
            (suma, resultado) => suma + resultado.cantidad,
            0
        );

        $e("resumenEstadisticas").textContent =
            `${resultados.length} carpetas · ${total} archivos contabilizados` +
            (comparativa.subcarpetas
                ? " · Incluye subcarpetas"
                : " · Solo archivos directos");

        const tablaHTML = document.createElement("table");
        tablaHTML.className = "estad-tabla";

        tablaHTML.innerHTML = `
            <thead>
                <tr>
                    <th>Posición</th>
                    <th>Carpeta</th>
                    <th>Archivos</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const cuerpo = tablaHTML.querySelector("tbody");

        const maximo = Math.max(
            1,
            ...resultados.map(r => r.cantidad)
        );

        resultados.forEach((resultado, indice) => {

            const fila = document.createElement("tr");

            const posicion = document.createElement("td");
            posicion.textContent = indice + 1;

            const nombre = document.createElement("td");
            nombre.textContent = resultado.nombre;

            if (resultado.faltante) {
                nombre.title = "Esta carpeta fue eliminada.";
            }

            const cantidad = document.createElement("td");
            cantidad.textContent = resultado.cantidad;

            fila.append(posicion, nombre, cantidad);
            cuerpo.appendChild(fila);

            const grupo = document.createElement("div");
            grupo.className = "estad-barra-grupo";

            const etiqueta = document.createElement("div");
            etiqueta.className = "estad-barra-etiqueta";

            const texto = document.createElement("span");
            texto.textContent = resultado.nombre;

            const numero = document.createElement("strong");
            numero.textContent = resultado.cantidad;

            etiqueta.append(texto, numero);

            const pista = document.createElement("div");
            pista.className = "estad-barra-pista";

            const barra = document.createElement("div");
            barra.className = "estad-barra";

            barra.style.width =
                `${(resultado.cantidad / maximo) * 100}%`;

            pista.appendChild(barra);
            grupo.append(etiqueta, pista);
            grafica.appendChild(grupo);
        });

        tabla.appendChild(tablaHTML);
    }

    function iniciar() {

        if (!$e("panelEstadisticas")) return;

        cargarComparativas();

        $e("btnEstadisticas").addEventListener(
            "click",
            mostrarPanel
        );

        $e("cerrarEstadisticas").addEventListener(
            "click",
            cerrarPanel
        );

        $e("nuevaComparativa").addEventListener(
            "click",
            () => abrirFormulario()
        );

        $e("cancelarComparativa").addEventListener(
            "click",
            mostrarLista
        );

        $e("volverComparativas").addEventListener(
            "click",
            mostrarLista
        );

        $e("formComparativa").addEventListener(
            "submit",
            guardarFormulario
        );

        $e("buscarCarpetaComparativa").addEventListener(
            "input",
            renderizarSelectorCarpetas
        );

        $e("editarComparativaActual").addEventListener(
            "click",
            () => abrirFormulario(comparativaActual)
        );

        $e("actualizarEstadisticas").addEventListener(
            "click",
            () => abrirComparativa(comparativaActual)
        );

        document.addEventListener("keydown", evento => {

            if (
                evento.key === "Escape" &&
                !$e("panelEstadisticas").classList.contains("oculto")
            ) {
                cerrarPanel();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }

})();
