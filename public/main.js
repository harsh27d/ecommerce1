document.addEventListener('DOMContentLoaded', () => {
  // Load products
  fetch('/products')
    .then(res => res.json())
    .then(products => {
      const container = document.getElementById('product-list');
      container.innerHTML = '';
      
      products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
          <img src="${product.image_url || 'placeholder.jpg'}" alt="${product.name}">
          <h3>${product.name}</h3>
          <p>$${product.price.toFixed(2)}</p>
          <button onclick="addToCart(${product.id})">Add to Cart</button>
        `;
        container.appendChild(productCard);
      });
    });
});

function addToCart(productId) {
  fetch('/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ productId, quantity: 1 })
  })
  .then(response => {
    if (response.ok) alert('Added to cart!');
    else alert('Error adding to cart');
  });
}

// Login functionality
document.getElementById('loginForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  fetch('/login', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (response.redirected) window.location = response.url;
    else alert('Login failed');
  });
});
