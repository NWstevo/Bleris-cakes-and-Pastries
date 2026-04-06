document.addEventListener("DOMContentLoaded", () => {
    // Cart functionality
    const cart = [];
    const cartIcon = document.getElementById('cartIcon');
    const cartSidebar = document.getElementById('cartSidebar');
    const closeCart = document.getElementById('closeCart');
    const overlay = document.getElementById('overlay');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const productsScroll = document.getElementById("products-scroll");
    const productsGrid = document.getElementById("products-grid");

    // Utility: format money consistently
    const formatMoney = (n) => n.toFixed(2);

    // Hint browser to lazy-load product images (perf optimization)
    document.querySelectorAll('.product-image img').forEach(img => {
        try { if (!img.loading) img.loading = 'lazy'; } catch (e) {}
    });

    // Event delegation for cart items to avoid re-binding on every render
    if (cartItems) {
        cartItems.addEventListener('change', (e) => {
            if (e.target && e.target.classList.contains('item-quantity')) {
                const id = e.target.getAttribute('data-id');
                const newQuantity = parseInt(e.target.value, 10);
                if (newQuantity < 1 || Number.isNaN(newQuantity)) {
                    e.target.value = 1;
                    return;
                }
                const item = cart.find(it => it.id === id);
                if (item) {
                    item.quantity = newQuantity;
                    updateCart();
                }
            }
        });

        cartItems.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('.remove-item');
            if (btn) {
                const id = btn.getAttribute('data-id');
                const index = cart.findIndex(it => it.id === id);
                if (index !== -1) {
                    cart.splice(index, 1);
                    updateCart();
                }
            }
        });
    }

    // Trigger flip animation on a set of product cards
    function applyFlip(container) {
        if (!container) return;
        const cards = container.querySelectorAll('.product-card');
        cards.forEach(card => {
            card.classList.remove('flip');
            void card.offsetWidth;
            card.classList.add('flip');
            const cleanup = () => {
                card.classList.remove('flip');
                card.removeEventListener('animationend', cleanup);
            };
            card.addEventListener('animationend', cleanup);
        });
    }

    function updateProductsScrollFade() {
        if (!productsScroll) return;
        const { scrollTop, scrollHeight, clientHeight } = productsScroll;
        const maxScrollTop = Math.max(scrollHeight - clientHeight, 0);
        const atTop = scrollTop <= 2;
        const atBottom = scrollTop >= maxScrollTop - 2;
        productsScroll.dataset.scrollTop = String(!atTop);
        productsScroll.dataset.scrollBottom = String(!atBottom);
    }

    // Scroll reveal animations using IntersectionObserver
    function initRevealAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                } else {
                    entry.target.classList.remove('in-view');
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

        const heroBits = document.querySelectorAll('.hero-logo, .hero-content h1, .hero-content p');
        heroBits.forEach(el => el.classList.add('reveal', 'slide-up'));

        const headers = document.querySelectorAll('.catalogue, section h2');
        headers.forEach(el => el.classList.add('reveal', 'slide-up'));

        const footerBits = document.querySelectorAll('.footer-section');
        footerBits.forEach(el => el.classList.add('reveal', 'slide-up'));

        function prepCards(container) {
            if (!container) return;
            const cards = Array.from(container.querySelectorAll('.product-card'));
            cards.forEach((card, i) => {
                card.classList.add('reveal', 'slide-up');
                card.style.transitionDelay = `${i * 80}ms`;
            });
            cards.forEach(card => observer.observe(card));
        }

        prepCards(productsGrid);
        [...heroBits, ...headers, ...footerBits].forEach(el => observer.observe(el));
    }

    function openCartSidebar() {
        cartSidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Open cart
    cartIcon.addEventListener('click', openCartSidebar);
    cartIcon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openCartSidebar();
        }
    });

    // Close cart
    closeCart.addEventListener('click', closeCartSidebar);
    overlay.addEventListener('click', closeCartSidebar);

    function closeCartSidebar() {
        cartSidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // Add to cart functionality
    const addToCartButtons = document.querySelectorAll('.btn-add-to-cart');
    addToCartButtons.forEach(button => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            const name = button.getAttribute('data-name');
            const price = parseFloat(button.getAttribute('data-price'));
            const image = button.getAttribute('data-image');
            const quantity = parseInt(button.parentElement.querySelector('.quantity-select').value, 10);

            const existingItem = cart.find(item => item.id === id);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({
                    id,
                    name,
                    price,
                    image,
                    quantity
                });
            }

            updateCart();
            alert(`${quantity} ${name}(s) added to cart!`);
        });
    });

    // Update cart display (build once, minimal DOM writes)
    function updateCart() {
        const cartCount = document.querySelector('.cart-count');
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = totalItems;

        if (cart.length === 0) {
            cartItems.innerHTML = '<p class="empty-cart-message">Your cart is empty</p>';
        } else {
            let html = '';
            cart.forEach(item => {
                html += `
                <div class="cart-item">
                    <div class="cart-item-image">
                        <img src="${item.image}" alt="${item.name}">
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-price">$${formatMoney(item.price)} x ${item.quantity}</div>
                        <div class="cart-item-actions">
                            <input type="number" min="1" value="${item.quantity}" class="item-quantity" data-id="${item.id}" style="width: 60px; padding: 5px;">
                            <button class="remove-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            });
            cartItems.innerHTML = html;
        }

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = `Total: $${formatMoney(total)}`;
    }

    // Checkout functionality
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const address = document.getElementById('address').value;

        if (!name || !email || !phone || !address) {
            alert('Please fill in all customer information fields!');
            return;
        }

        alert('Order placed successfully! Thank you for your purchase.');

        cart.length = 0;
        updateCart();
        closeCartSidebar();

        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('address').value = '';
    });

    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }

    // Newsletter form handling
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const emailInput = this.querySelector('input[type="email"]');
            const email = emailInput.value;

            if (email) {
                alert('Thank you for subscribing to our newsletter!');
                emailInput.value = '';
            }
        });
    }

    initRevealAnimations();
    applyFlip(productsGrid);

    if (productsScroll) {
        updateProductsScrollFade();
        productsScroll.addEventListener('scroll', updateProductsScrollFade, { passive: true });
        window.addEventListener('resize', updateProductsScrollFade);
    }
});
