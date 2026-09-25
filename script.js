const API_URL =
  "https://script.google.com/macros/s/AKfycbz-kG_TQiPgwzgeJgXyyPNw3iFsXRpO57hs0rIjC9gYCNBIm1z8S9wliczmksTLbpdS/exec";

// Número de WhatsApp que recibe los pedidos, en formato internacional
// sin espacios ni signos: código de país + código de área + número.
const WHATSAPP_NUMBER = "5492634797676";

let products = [];
let cart = [];

const productsGrid = document.getElementById("productsGrid");
const cartButton = document.getElementById("cartButton");
const cartPanel = document.getElementById("cartPanel");
const cartOverlay = document.getElementById("cartOverlay");
const closeCart = document.getElementById("closeCart");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const checkoutButton = document.querySelector(".checkout-button");
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

// ---------------------------------------------------------
// MENÚ HAMBURGUESA (mobile)
// ---------------------------------------------------------
if (menuToggle && nav) {
  menuToggle.addEventListener("click", function () {
    const isOpen = nav.classList.toggle("active");
    menuToggle.classList.toggle("active", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Cerrar menú" : "Abrir menú"
    );
  });

  // Al tocar un link del menú, se cierra solo (mejor UX en celular)
  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      nav.classList.remove("active");
      menuToggle.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Abrir menú");
    });
  });
}

// ---------------------------------------------------------
// BUG FIX 1: Number() falla silenciosamente si PRECIO/STOCK
// vienen de Sheets como texto formateado ("$ 1.500", "1500,50", etc).
// Esta función limpia el valor antes de convertirlo a número.
// ---------------------------------------------------------
function toNumber(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value)
    .replace(/[^\d,.-]/g, "") // saca $, ARS, espacios, etc.
    .replace(/\.(?=\d{3}(?:\D|$))/g, "") // saca puntos de miles (1.500 -> 1500)
    .replace(",", "."); // coma decimal -> punto
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function loadProducts() {
  console.log("Cargando productos...");
  try {
    const response = await fetch(API_URL + "?t=" + Date.now());
    console.log("Estado de respuesta:", response.status);

    if (!response.ok) {
      throw new Error("Error HTTP: " + response.status);
    }

    const data = await response.json();
    console.log("Datos recibidos:", data);
    console.table(data);

    if (!Array.isArray(data)) {
      throw new Error("La API no devolvió una lista de productos.");
    }

    products = data;
    console.log("Cantidad de productos:", products.length);
    renderProducts();
  } catch (error) {
    console.error("Error cargando productos:", error);
    if (productsGrid) {
      productsGrid.textContent = "No se pudieron cargar los productos.";
    }
  }
}

function isProductActive(product) {
  const activo = String(product.ACTIVO || "").trim().toUpperCase();
  return (
    activo === "SI" ||
    activo === "SÍ" ||
    activo === "TRUE" ||
    activo === "ACTIVO" ||
    activo === "1"
  );
}

function renderProducts() {
  productsGrid.innerHTML = "";
  const activeProducts = products.filter(isProductActive);

  console.log("Productos activos:", activeProducts.length);

  if (activeProducts.length === 0) {
    // -----------------------------------------------------
    // BUG FIX 2: antes, si no había productos activos pero SÍ
    // había productos cargados, se mostraban TODOS (incluidos
    // los inactivos) directamente en la tienda como "modo
    // diagnóstico". Eso significaba que un cliente real podía
    // ver y comprar productos marcados como inactivos.
    // Ahora ese modo diagnóstico solo va a la consola, nunca
    // a la pantalla del cliente.
    // -----------------------------------------------------
    if (products.length > 0) {
      console.warn(
        "Hay productos cargados pero ninguno está ACTIVO. Revisá la columna ACTIVO en Sheets.",
        products
      );
    }
    productsGrid.textContent = "No hay productos disponibles.";
    return;
  }

  renderProductList(activeProducts);
}

function renderProductList(productList) {
  productsGrid.innerHTML = "";

  productList.forEach(function (product) {
    // -----------------------------------------------------
    // BUG FIX 3: "product.ID || ''" convierte un ID = 0 en
    // string vacío, porque 0 es "falsy" en JavaScript. Si en
    // algún momento un producto tiene ID 0, desaparecía del
    // carrito silenciosamente. Se reemplaza por una
    // comprobación explícita de undefined/null.
    // -----------------------------------------------------
    const id =
      product.ID !== undefined && product.ID !== null
        ? String(product.ID)
        : "";
    const name = String(product.NOMBRE || "Producto");
    const category = String(product.CATEGORIA || "");
    const price = toNumber(product.PRECIO);
    const stock = toNumber(product.STOCK);
    const image = String(product.IMAGEN || "").trim();
    const description = String(product.DESCRIPCION || "");

    const card = document.createElement("article");
    card.className = "product-card";

    const imageContainer = document.createElement("div");
    imageContainer.className = "product-image";

    if (image !== "") {
      const img = document.createElement("img");
      img.src = image;
      img.alt = name;
      img.loading = "lazy";
      img.onerror = function () {
        // BUG FIX 4: si la imagen falla, antes quedaba un hueco
        // vacío (display: none sin reemplazo). Ahora se muestra
        // el placeholder de categoría igual que cuando no hay imagen.
        img.remove();
        const placeholder = document.createElement("div");
        placeholder.className = "placeholder-image";
        placeholder.textContent = category || "SIN IMAGEN";
        imageContainer.appendChild(placeholder);
      };
      imageContainer.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder-image";
      placeholder.textContent = category || "SIN IMAGEN";
      imageContainer.appendChild(placeholder);
    }

    const productInfo = document.createElement("div");
    productInfo.className = "product-info";

    const title = document.createElement("h3");
    title.textContent = name;

    const categoryElement = document.createElement("p");
    categoryElement.className = "product-category";
    categoryElement.textContent = category;

    const descriptionElement = document.createElement("p");
    descriptionElement.className = "product-description";
    descriptionElement.textContent = description;

    const bottom = document.createElement("div");
    bottom.className = "product-bottom";

    const priceContainer = document.createElement("div");

    const priceElement = document.createElement("div");
    priceElement.className = "price";
    priceElement.textContent = formatPrice(price);
    priceContainer.appendChild(priceElement);

    const stockElement = document.createElement("span");
    stockElement.className = "stock";
    if (stock <= 0) {
      stockElement.classList.add("empty");
      stockElement.textContent = "Sin stock";
    } else if (stock <= 3) {
      stockElement.classList.add("low");
      stockElement.textContent = "Últimas unidades";
    } else {
      stockElement.classList.add("available");
      stockElement.textContent = "Stock disponible: " + stock;
    }
    priceContainer.appendChild(stockElement);

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    if (stock <= 0 || id === "") {
      addButton.disabled = true;
      addButton.textContent = stock <= 0 ? "SIN STOCK" : "PRODUCTO INVÁLIDO";
    } else {
      addButton.textContent = "AGREGAR";
      addButton.addEventListener("click", function () {
        addToCart(id);
      });
    }

    bottom.appendChild(priceContainer);
    bottom.appendChild(addButton);

    productInfo.appendChild(title);
    productInfo.appendChild(categoryElement);
    productInfo.appendChild(descriptionElement);
    productInfo.appendChild(bottom);

    card.appendChild(imageContainer);
    card.appendChild(productInfo);

    productsGrid.appendChild(card);
  });
}

if (cartButton) {
  cartButton.addEventListener("click", function () {
    cartPanel.classList.add("active");
    cartOverlay.classList.add("active");
  });
}

function closeCartPanel() {
  if (cartPanel) {
    cartPanel.classList.remove("active");
  }
  if (cartOverlay) {
    cartOverlay.classList.remove("active");
  }
}

if (closeCart) {
  closeCart.addEventListener("click", closeCartPanel);
}
if (cartOverlay) {
  cartOverlay.addEventListener("click", closeCartPanel);
}

function addToCart(productId) {
  const product = products.find(function (item) {
    return String(item.ID) === String(productId);
  });

  if (!product) {
    alert("No se encontró el producto.");
    return;
  }

  const stock = toNumber(product.STOCK);
  if (stock <= 0) {
    alert("Este producto no tiene stock.");
    return;
  }

  const existingProduct = cart.find(function (item) {
    return String(item.ID) === String(productId);
  });

  if (existingProduct) {
    if (existingProduct.quantity >= stock) {
      alert("No hay más unidades disponibles.");
      return;
    }
    existingProduct.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  updateCart();
  if (cartPanel) {
    cartPanel.classList.add("active");
  }
  if (cartOverlay) {
    cartOverlay.classList.add("active");
  }
}

function updateCart() {
  if (!cartItems) {
    return;
  }

  cartItems.innerHTML = "";
  let total = 0;
  let totalProducts = 0;

  if (cart.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-cart";
    emptyMessage.textContent = "Tu carrito está vacío.";
    cartItems.appendChild(emptyMessage);
  }

  cart.forEach(function (product, index) {
    // BUG FIX 5: usaba Number(product.PRECIO) de nuevo en vez de
    // toNumber(), lo que reintroducía el mismo problema de parseo
    // dentro del carrito aunque ya se hubiera arreglado en el catálogo.
    const price = toNumber(product.PRECIO);
    const quantity = Number(product.quantity) || 1;
    total += price * quantity;
    totalProducts += quantity;

    const item = document.createElement("div");
    item.className = "cart-product";

    const info = document.createElement("div");
    info.className = "cart-product-info";

    const name = document.createElement("h4");
    name.textContent = product.NOMBRE;

    const details = document.createElement("p");
    details.textContent = formatPrice(price) + " × " + quantity;

    info.appendChild(name);
    info.appendChild(details);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-product";
    removeButton.textContent = "ELIMINAR";
    removeButton.addEventListener("click", function () {
      removeProduct(index);
    });

    item.appendChild(info);
    item.appendChild(removeButton);

    cartItems.appendChild(item);
  });

  if (cartCount) {
    cartCount.textContent = totalProducts;
  }
  if (cartTotal) {
    cartTotal.textContent = formatPrice(total);
  }
}

function removeProduct(index) {
  cart.splice(index, 1);
  updateCart();
}

function formatPrice(price) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);
}

// ---------------------------------------------------------
// Arma el texto del pedido a partir del carrito, listo para
// enviarlo por WhatsApp.
// ---------------------------------------------------------
function buildWhatsappMessage() {
  let message = "Hola! Quiero hacer este pedido:\n\n";
  let total = 0;

  cart.forEach(function (product) {
    const price = toNumber(product.PRECIO);
    const quantity = Number(product.quantity) || 1;
    const subtotal = price * quantity;
    total += subtotal;

    message +=
      "• " +
      product.NOMBRE +
      " x" +
      quantity +
      " — " +
      formatPrice(subtotal) +
      "\n";
  });

  message += "\nTotal: " + formatPrice(total);

  return message;
}

if (checkoutButton) {
  checkoutButton.addEventListener("click", function () {
    if (cart.length === 0) {
      alert("Tu carrito está vacío.");
      return;
    }

    const message = buildWhatsappMessage();
    const url =
      "https://wa.me/" +
      WHATSAPP_NUMBER +
      "?text=" +
      encodeURIComponent(message);

    window.open(url, "_blank");
  });
}

updateCart();
loadProducts();
