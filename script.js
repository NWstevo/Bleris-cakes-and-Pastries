document.addEventListener("DOMContentLoaded", () => {
    // Dark mode toggle
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            body.classList.add('dark-mode');
        }

        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    const consentBanner = document.getElementById('consentBanner');
    const consentButtons = document.querySelectorAll('.consent-btn');

    if (consentBanner) {
        const storedConsent = localStorage.getItem('bleris-consent');
        if (storedConsent) {
            consentBanner.classList.add('is-hidden');
        }

        consentButtons.forEach(button => {
            button.addEventListener('click', () => {
                const choice = button.getAttribute('data-consent') || 'essential';
                localStorage.setItem('bleris-consent', choice);
                consentBanner.classList.add('is-hidden');
            });
        });
    }

    // Cart functionality
    const cart = [];
    const cartIcon = document.getElementById('cartIcon');
    const cartSidebar = document.getElementById('cartSidebar');
    const closeCart = document.getElementById('closeCart');
    const overlay = document.getElementById('overlay');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const addSelectedServicesBtn = document.getElementById('addSelectedServices');
    const contactPhoneLink = document.querySelector('.contact-list a[href^="tel:"]');
    const mobileCardsQuery = window.matchMedia('(max-width: 768px)');
    const hasCartUi = Boolean(cartIcon && cartSidebar && closeCart && overlay && cartItems);

    const productsScroll = document.getElementById("products-scroll");
    const productsGrid = document.getElementById("products-grid");

    // Utility: format money consistently in whole FCFA values
    const formatMoney = (n) => `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0
    }).format(n)} FCFA`;

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

    function createImageLightbox() {
        const lightbox = document.createElement('div');
        lightbox.className = 'image-lightbox';
        lightbox.innerHTML = `
            <button class="lightbox-close" type="button" aria-label="Close image viewer">
                <i class="fas fa-times"></i>
            </button>
            <div class="lightbox-viewport">
                <img src="" alt="">
                <video class="lightbox-video" controls playsinline style="display: none;"></video>
            </div>
            <div class="lightbox-toolbar">
                <button class="lightbox-control lightbox-display" type="button" aria-label="View full image">View</button>
            </div>
        `;
        document.body.appendChild(lightbox);

        const lightboxImage = lightbox.querySelector('img');
        const lightboxVideo = lightbox.querySelector('.lightbox-video');

        function closeLightbox() {
            lightbox.classList.remove('is-open');
            lightboxImage.src = '';
            lightboxImage.alt = '';
            lightboxImage.style.display = '';
            lightboxVideo.pause();
            lightboxVideo.removeAttribute('src');
            lightboxVideo.load();
            lightboxVideo.style.display = 'none';
            document.body.style.overflow = '';
        }

        function openLightbox(src, alt, isVideo) {
            if (isVideo) {
                lightboxImage.style.display = 'none';
                lightboxVideo.style.display = '';
                lightboxVideo.src = src;
                lightboxVideo.play().catch(() => {});
            } else {
                lightboxVideo.style.display = 'none';
                lightboxImage.style.display = '';
                lightboxImage.src = src;
                lightboxImage.alt = alt;
            }
            lightbox.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        }

        lightbox.addEventListener('click', (e) => {
            if (e.target.closest('.lightbox-close')) {
                closeLightbox();
                return;
            }

            // Let native video controls (play/pause/seek/volume) work without
            // the click bubbling up and closing the lightbox.
            if (e.target.closest('.lightbox-video')) {
                return;
            }

            const control = e.target.closest('.lightbox-control');
            if (control) {
                closeLightbox();
                return;
            }

            closeLightbox();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
                closeLightbox();
            }
        });

        return { openLightbox, closeLightbox, lightbox };
    }

    const { openLightbox } = createImageLightbox();

    function initMobileProductCards() {
        const cards = document.querySelectorAll('.product-card');
        if (!cards.length) return;

        function syncMobileCardState() {
            const isMobile = mobileCardsQuery.matches;

            cards.forEach(card => {
                const productInfo = card.querySelector('.product-info');
                const productTitle = card.querySelector('.product-title');
                const productImage = card.querySelector('.product-image img, .product-image video');

                if (!productInfo || !productTitle || !productImage) return;

                let toggleButton = card.querySelector('.mobile-card-toggle');
                if (!toggleButton) {
                    toggleButton = document.createElement('button');
                    toggleButton.type = 'button';
                    toggleButton.className = 'mobile-card-toggle';
                    productInfo.appendChild(toggleButton);
                }

                let zoomButton = card.querySelector('.product-image-zoom');
                if (!zoomButton) {
                    zoomButton = document.createElement('button');
                    zoomButton.type = 'button';
                    zoomButton.className = 'product-image-zoom';
                    zoomButton.setAttribute('aria-label', `View image for ${productTitle.textContent}`);
                    zoomButton.textContent = 'View';
                    card.appendChild(zoomButton);
                }

                if (!isMobile) {
                    card.classList.remove('mobile-card-collapsed', 'is-expanded');
                    toggleButton.textContent = 'More';
                    return;
                }

                const isExpanded = card.classList.contains('is-expanded');
                card.classList.toggle('mobile-card-collapsed', !isExpanded);
                toggleButton.textContent = isExpanded ? 'Show less' : 'More';
            });
        }

        // Delegated so it keeps working for cards added later (e.g. by the
        // admin panel), not just the ones present when the page first loaded.
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            if (!card) return;

            const toggleButton = e.target.closest('.mobile-card-toggle');
            if (toggleButton) {
                e.preventDefault();
                const shouldExpand = !card.classList.contains('is-expanded');
                document.querySelectorAll('.product-card').forEach(otherCard => {
                    if (otherCard !== card) {
                        otherCard.classList.remove('is-expanded');
                    }
                });
                card.classList.toggle('is-expanded', shouldExpand);
                syncMobileCardState();
                if (shouldExpand) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                return;
            }

            const zoomButton = e.target.closest('.product-image-zoom');
            const clickedProductImage = e.target.closest('.product-image');
            if (zoomButton || clickedProductImage) {
                e.preventDefault();
                const media = card.querySelector('.product-image img, .product-image video');
                if (media) {
                    openLightbox(media.currentSrc || media.src, media.alt, media.tagName === 'VIDEO');
                }
            }
        });

        if (typeof mobileCardsQuery.addEventListener === 'function') {
            mobileCardsQuery.addEventListener('change', syncMobileCardState);
        } else if (typeof mobileCardsQuery.addListener === 'function') {
            mobileCardsQuery.addListener(syncMobileCardState);
        }

        syncMobileCardState();
    }

    function initCatalogueShots() {
        const shots = document.querySelectorAll('.catalogue-shot');
        if (!shots.length) return;

        shots.forEach(shot => {
            const media = shot.querySelector('img, video');
            if (!media) return;
            const isVideo = media.tagName === 'VIDEO';
            const openMedia = () => openLightbox(media.currentSrc || media.src, media.alt, isVideo);

            shot.addEventListener('mouseenter', () => {
                shot.classList.add('is-active');
            });

            shot.addEventListener('mouseleave', () => {
                shot.classList.remove('is-active');
            });

            shot.addEventListener('focus', () => {
                shot.classList.add('is-active');
            });

            shot.addEventListener('blur', () => {
                shot.classList.remove('is-active');
            });

            shot.addEventListener('click', (e) => {
                const displayButton = e.target.closest('.product-image-zoom');
                if (displayButton) {
                    openMedia();
                    return;
                }

                const interactiveTarget = e.target.closest('button, select, option');
                if (interactiveTarget) {
                    return;
                }
                openMedia();
            });

            shot.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openMedia();
                }
            });
        });
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

    function addItemToCart({ id, name, price, image, quantity }) {
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
    }

    // Add to cart functionality — delegated so products added later
    // (e.g. by the admin panel) work without any extra wiring.
    document.addEventListener('click', (e) => {
        const button = e.target.closest && e.target.closest('.btn-add-to-cart');
        if (!button) return;

        const id = button.getAttribute('data-id');
        const name = button.getAttribute('data-name');
        const price = parseFloat(button.getAttribute('data-price'));
        const image = button.getAttribute('data-image');
        const quantitySelect = button.parentElement ? button.parentElement.querySelector('.quantity-select') : null;
        const quantity = quantitySelect ? parseInt(quantitySelect.value, 10) : 1;
        addItemToCart({ id, name, price, image, quantity });
        alert(`${quantity} ${name}(s) added to cart!`);
    });

    if (addSelectedServicesBtn) {
        addSelectedServicesBtn.addEventListener('click', () => {
            const selectedOptions = Array.from(document.querySelectorAll('.service-option input[type="checkbox"]:checked'));

            if (!selectedOptions.length) {
                alert('Select at least one service item first.');
                return;
            }

            let addedCount = 0;

            selectedOptions.forEach((checkbox) => {
                const option = checkbox.closest('.service-option');
                const priceSelect = option ? option.querySelector('.service-option-price') : null;
                const baseId = checkbox.getAttribute('data-id');
                const baseName = checkbox.getAttribute('data-name');
                let id = baseId;
                let name = baseName;
                let price = parseFloat(checkbox.getAttribute('data-price'));

                if (priceSelect) {
                    const selectedChoice = priceSelect.options[priceSelect.selectedIndex];
                    const selectedValue = priceSelect.value;
                    const selectedLabel = selectedChoice && selectedChoice.dataset.label
                        ? selectedChoice.dataset.label
                        : `${selectedValue} FCFA`;

                    id = `${baseId}-${selectedValue}`;
                    name = `${baseName} (${selectedLabel})`;
                    price = parseFloat(selectedValue);
                }

                if (Number.isNaN(price)) {
                    return;
                }

                addItemToCart({
                    id,
                    name,
                    price,
                    image: '',
                    quantity: 1
                });

                checkbox.checked = false;
                addedCount += 1;
            });

            if (!addedCount) {
                alert('The selected services could not be added to cart.');
                return;
            }

            alert(`${addedCount} selected service item(s) added to cart!`);
        });
    }

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
                const itemImageMarkup = item.image
                    ? `<img src="${item.image}" alt="${item.name}">`
                    : `<div class="cart-item-service-logo" aria-label="Service logo">Service</div>`;
                html += `
                <div class="cart-item">
                    <div class="cart-item-image">
                        ${itemImageMarkup}
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-price">${formatMoney(item.price)} x ${item.quantity}</div>
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
        cartTotal.textContent = `Total: ${formatMoney(total)}`;
    }

    // Checkout functionality
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                alert('Your cart is empty!');
                return;
            }

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const address = document.getElementById('address').value;
            const paymentMethod = document.querySelector('input[name="payment"]:checked');

            if (!name || !email || !phone || !address) {
                alert('Please fill in all customer information fields!');
                return;
            }

            const businessPhone = (contactPhoneLink ? contactPhoneLink.getAttribute('href') : 'tel:+237653364537')
                .replace('tel:', '')
                .replace(/\D/g, '');

            const paymentLabel = paymentMethod
                ? paymentMethod.parentElement.querySelector('label').textContent
                : 'Not specified';

            const itemLines = cart.map((item) => (
                `- ${item.name} x ${item.quantity} = ${formatMoney(item.price * item.quantity)}`
            ));

            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const message = [
                'Hello Bleris Cakes and Pastries, I would like to place an order.',
                '',
                'Order items:',
                ...itemLines,
                '',
                `Total: ${formatMoney(total)}`,
                '',
                'Customer details:',
                `Name: ${name}`,
                `Email: ${email}`,
                `Phone: ${phone}`,
                `Address: ${address}`,
                `Payment method: ${paymentLabel}`
            ].join('\n');

            const whatsappUrl = `https://wa.me/${businessPhone}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank', 'noopener');
        });
    }

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
    initMobileProductCards();
    initCatalogueShots();

    if (productsScroll) {
        updateProductsScrollFade();
        productsScroll.addEventListener('scroll', updateProductsScrollFade, { passive: true });
        window.addEventListener('resize', updateProductsScrollFade);
    }
});
