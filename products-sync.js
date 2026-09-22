// Bleris Cakes and Pastries — live product sync.
//
// Reads product data from Supabase (if supabase-config.js has been filled in)
// and applies it on top of the catalogue already written in index.html:
//   - existing items get their price/name/photo-or-video updated in place
//   - items the admin removed are hidden
//   - items the admin added (that don't exist in the static HTML) are
//     appended to the catalogue as new cards
//
// If Supabase isn't configured yet, or the request fails (offline, etc.),
// this script does nothing and the site keeps showing the prices already
// hardcoded in index.html — it never breaks the page.
(function () {
    // Every product id currently hardcoded in index.html. Used to tell
    // "existing item the admin edited" apart from "brand new item the
    // admin added" and to detect items the admin removed entirely.
    var SEEDED_PRODUCT_IDS = [
        '201', '202', '203', '204', '206',
        '101', '102', '103', '104', '106', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117',
        '1', '2', '3', '4', '5', '6', '8', '9', '10', '11', '12', '13'
    ];

    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function formatMoney(n) {
        var value = Number(n) || 0;
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value) + ' FCFA';
    }

    function escapeHtml(value) {
        var div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function findCardForId(id) {
        var btn = document.querySelector('.btn-add-to-cart[data-id="' + CSS.escape(String(id)) + '"]');
        if (!btn) return null;
        var card = btn.closest('.product-card, .catalogue-shot');
        return { card: card, btn: btn };
    }

    function hideCard(card) {
        if (card) card.style.display = 'none';
    }

    // .product-image is the positioned wrapper in the "product-card" template;
    // the plain "catalogue-shot" figure is already positioned itself, so it
    // doubles as its own media container.
    function getMediaContainer(card) {
        return card.querySelector('.product-image') || card;
    }

    function setVideoBadge(container, show) {
        var existing = container.querySelector('.product-image-video-badge');
        if (show && !existing) {
            var badge = document.createElement('span');
            badge.className = 'product-image-video-badge';
            badge.textContent = '▶ Video';
            container.appendChild(badge);
        } else if (!show && existing) {
            existing.remove();
        }
    }

    // Swaps the element for an <img>/<video> of the right kind if the
    // current one doesn't match, preserving its position in the DOM.
    function ensureMediaElement(mediaEl, mediaType) {
        var wantVideo = mediaType === 'video';
        var isVideo = mediaEl.tagName === 'VIDEO';
        if (wantVideo === isVideo) return mediaEl;

        var replacement = document.createElement(wantVideo ? 'video' : 'img');
        if (wantVideo) {
            replacement.muted = true;
            replacement.loop = true;
            replacement.playsInline = true;
            replacement.preload = 'metadata';
            if (!prefersReducedMotion) replacement.autoplay = true;
        } else {
            replacement.loading = 'lazy';
        }
        mediaEl.replaceWith(replacement);
        return replacement;
    }

    function applyRowToCard(card, btn, row) {
        card.style.display = '';
        var priceEl = card.querySelector('.product-price');
        var titleEl = card.querySelector('.product-title, .catalogue-shot-title');
        var mediaEl = card.querySelector('img, video');
        var isVideo = row.media_type === 'video';

        if (priceEl) priceEl.textContent = formatMoney(row.price);
        if (titleEl && row.name) titleEl.textContent = row.name;

        if (mediaEl && row.image) {
            mediaEl = ensureMediaElement(mediaEl, row.media_type);
            mediaEl.src = row.image;
            if (mediaEl.tagName === 'IMG') {
                mediaEl.alt = row.name || mediaEl.alt;
            } else if (!prefersReducedMotion) {
                mediaEl.play().catch(function () {});
            }
            setVideoBadge(getMediaContainer(card), isVideo);
        }

        btn.setAttribute('data-price', row.price);
        if (row.name) btn.setAttribute('data-name', row.name);
        if (row.image) btn.setAttribute('data-image', row.image);

        var zoomBtn = card.querySelector('.product-image-zoom');
        if (zoomBtn && row.name) zoomBtn.setAttribute('aria-label', 'View image for ' + row.name);
        var qtySelect = card.querySelector('.quantity-select');
        if (qtySelect && row.name) qtySelect.setAttribute('aria-label', 'Select quantity for ' + row.name);
    }

    function buildNewCard(row) {
        var card = document.createElement('div');
        card.className = 'product-card set2 admin-added-product';
        var isVideo = row.media_type === 'video';

        var mediaMarkup = isVideo
            ? '<video src="' + escapeHtml(row.image || '') + '" muted loop playsinline preload="metadata"' + (prefersReducedMotion ? '' : ' autoplay') + '></video>' +
              '<span class="product-image-video-badge">▶ Video</span>'
            : '<img src="' + escapeHtml(row.image || '') + '" alt="' + escapeHtml(row.name) + '" loading="lazy">';

        var descriptionMarkup = row.description
            ? '<p class="product-copy">' + escapeHtml(row.description) + '</p>'
            : '';

        card.innerHTML =
            '<div class="product-image">' + mediaMarkup + '</div>' +
            '<div class="product-info">' +
                '<h3 class="product-title">' + escapeHtml(row.name) + '</h3>' +
                descriptionMarkup +
                '<p class="product-price">' + formatMoney(row.price) + '</p>' +
                '<div class="product-actions">' +
                    '<select class="quantity-select" aria-label="Select quantity for ' + escapeHtml(row.name) + '">' +
                        '<option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>' +
                    '</select>' +
                    '<button class="btn-add-to-cart" data-id="' + escapeHtml(row.id) + '" data-name="' + escapeHtml(row.name) + '" data-price="' + escapeHtml(row.price) + '" data-image="' + escapeHtml(row.image || '') + '">Add to cart</button>' +
                '</div>' +
            '</div>';

        return card;
    }

    function reconcile(rows) {
        var grid = document.getElementById('products-grid');
        if (!grid) return;

        var byId = {};
        rows.forEach(function (row) { byId[String(row.id)] = row; });

        // Existing (seeded) products: sync in place, or hide if removed/inactive.
        SEEDED_PRODUCT_IDS.forEach(function (id) {
            var found = findCardForId(id);
            if (!found || !found.card) return;
            var row = byId[id];
            if (!row || row.active === false) {
                hideCard(found.card);
            } else {
                applyRowToCard(found.card, found.btn, row);
            }
        });

        // New products the admin added (id not part of the original static markup).
        rows.forEach(function (row) {
            var id = String(row.id);
            if (SEEDED_PRODUCT_IDS.indexOf(id) !== -1) return;
            if (row.active === false) return;
            if (findCardForId(id)) return; // already rendered from a previous sync run
            grid.appendChild(buildNewCard(row));
        });
    }

    function init() {
        var url = window.BLERIS_SUPABASE_URL;
        var key = window.BLERIS_SUPABASE_ANON_KEY;
        if (!url || !key || typeof window.supabase === 'undefined') return;

        var client = window.supabase.createClient(url, key);
        client
            .from('products')
            .select('*')
            .then(function (result) {
                if (result.error || !result.data) return;
                reconcile(result.data);
            })
            .catch(function () {
                // Network/config issue — silently keep the static prices.
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
