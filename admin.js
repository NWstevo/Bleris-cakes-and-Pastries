// Bleris Cakes and Pastries — staff admin panel logic.
// Handles login (Supabase Auth) and product CRUD (add / edit / update / remove).
(function () {
    var client = null;
    var currentProducts = [];

    var MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // matches Supabase's Free-plan global file size limit
    var MAX_VIDEO_SECONDS = 35; // ~30s clips, with a little grace

    function $(id) { return document.getElementById(id); }

    function formatMoney(n) {
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n) || 0) + ' FCFA';
    }

    function setMediaStatus(message, isError) {
        var el = $('mediaUploadStatus');
        el.textContent = message || '';
        el.classList.toggle('is-error', Boolean(isError));
    }

    function getVideoDuration(file) {
        return new Promise(function (resolve) {
            var video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = function () {
                URL.revokeObjectURL(video.src);
                resolve(video.duration || 0);
            };
            video.onerror = function () {
                resolve(0); // couldn't read it — don't block the upload over this
            };
            video.src = URL.createObjectURL(file);
        });
    }

    function showMediaPreview(url, mediaType) {
        var wrap = $('mediaPreviewWrap');
        var img = $('mediaPreviewImage');
        var video = $('mediaPreviewVideo');

        if (!url) {
            wrap.hidden = true;
            return;
        }

        wrap.hidden = false;
        if (mediaType === 'video') {
            img.hidden = true;
            img.src = '';
            video.hidden = false;
            video.src = url;
            video.play().catch(function () {});
        } else {
            video.hidden = true;
            video.pause();
            video.removeAttribute('src');
            img.hidden = false;
            img.src = url;
        }
    }

    function uploadMediaFile(file) {
        var isVideo = file.type.indexOf('video/') === 0;
        var safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
        var path = (isVideo ? 'videos/' : 'images/') + Date.now() + '-' + safeName;

        return client.storage.from('product-media')
            .upload(path, file, { contentType: file.type, upsert: false })
            .then(function (res) {
                if (res.error) throw res.error;
                var publicUrlResult = client.storage.from('product-media').getPublicUrl(path);
                return {
                    url: publicUrlResult.data.publicUrl,
                    mediaType: isVideo ? 'video' : 'image'
                };
            });
    }

    function escapeHtml(value) {
        var div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function showOnly(sectionId) {
        ['setupNotice', 'authSection', 'dashboardSection'].forEach(function (id) {
            $(id).hidden = id !== sectionId;
        });
    }

    function showLogin(message) {
        showOnly('authSection');
        $('authError').textContent = message || '';
    }

    function showDashboard() {
        showOnly('dashboardSection');
        closeForm();
        loadProducts();
    }

    // ---- Product list ----

    function loadProducts() {
        $('productList').innerHTML = '<p class="admin-loading">Loading products&hellip;</p>';
        client.from('products').select('*').order('name', { ascending: true }).then(function (res) {
            if (res.error) {
                $('productList').innerHTML = '<p class="admin-error">Could not load products: ' + escapeHtml(res.error.message) + '</p>';
                return;
            }
            currentProducts = res.data || [];
            renderProductList();
        });
    }

    function renderProductList() {
        var list = $('productList');
        if (!currentProducts.length) {
            list.innerHTML = '<p class="admin-empty">No products yet. Use "Add new item" to create one.</p>';
            return;
        }

        list.innerHTML = currentProducts.map(function (p) {
            var isRemoved = p.active === false;
            var isVideo = p.media_type === 'video';
            var thumbMarkup = isVideo
                ? '<video class="admin-product-thumb" src="' + escapeHtml(p.image || '') + '" muted playsinline preload="metadata"></video>'
                : '<img class="admin-product-thumb" src="' + escapeHtml(p.image || '') + '" alt="">';

            return (
                '<div class="admin-product-row' + (isRemoved ? ' is-inactive' : '') + '">' +
                    thumbMarkup +
                    '<div class="admin-product-info">' +
                        '<strong>' + escapeHtml(p.name) + '</strong>' +
                        '<span>' + formatMoney(p.price) + (isRemoved ? ' &middot; Removed from site' : '') + '</span>' +
                        '<span class="media-type-tag">' + (isVideo ? 'Video' : 'Photo') + '</span>' +
                    '</div>' +
                    '<div class="admin-product-actions">' +
                        '<button type="button" class="btn btn-secondary admin-edit-btn" data-id="' + escapeHtml(p.id) + '">Edit</button>' +
                        '<button type="button" class="btn admin-remove-btn" data-id="' + escapeHtml(p.id) + '" data-name="' + escapeHtml(p.name) + '">' + (isRemoved ? 'Restore' : 'Remove') + '</button>' +
                    '</div>' +
                '</div>'
            );
        }).join('');
    }

    // ---- Add / edit form ----

    function openForm(id) {
        var product = id ? currentProducts.find(function (p) { return String(p.id) === String(id); }) : null;

        $('formTitle').textContent = product ? 'Edit item' : 'Add new item';
        $('productId').value = product ? product.id : '';
        $('productName').value = product ? product.name : '';
        $('productPrice').value = product ? product.price : '';
        $('productImage').value = product ? (product.image || '') : '';
        $('productMediaType').value = product ? (product.media_type || 'image') : 'image';
        $('productDescription').value = product ? (product.description || '') : '';
        $('saveProductBtn').textContent = product ? 'Update item' : 'Add item';
        $('formError').textContent = '';
        $('productMediaFile').value = '';
        setMediaStatus('');
        showMediaPreview(product ? product.image : '', product ? product.media_type : 'image');

        $('productForm').hidden = false;
        $('productForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('productName').focus();
    }

    function closeForm() {
        $('productForm').hidden = true;
        $('productForm').reset();
        $('productMediaType').value = 'image';
        $('formError').textContent = '';
        setMediaStatus('');
        showMediaPreview('', 'image');
    }

    function saveProduct() {
        var name = $('productName').value.trim();
        var price = parseFloat($('productPrice').value);
        var image = $('productImage').value.trim();
        var mediaType = $('productMediaType').value === 'video' ? 'video' : 'image';
        var description = $('productDescription').value.trim();

        if (!name || Number.isNaN(price) || price < 0) {
            $('formError').textContent = 'Enter a valid name and a price of 0 or more.';
            return;
        }

        var existingId = $('productId').value;
        var saveBtn = $('saveProductBtn');
        saveBtn.disabled = true;

        var request;
        if (existingId) {
            request = client.from('products')
                .update({ name: name, price: price, image: image, media_type: mediaType, description: description })
                .eq('id', existingId);
        } else {
            var newId = 'custom-' + Date.now();
            request = client.from('products')
                .insert({ id: newId, name: name, price: price, image: image, media_type: mediaType, description: description, active: true });
        }

        request.then(function (res) {
            saveBtn.disabled = false;
            if (res.error) {
                $('formError').textContent = res.error.message;
                return;
            }
            closeForm();
            loadProducts();
        });
    }

    function toggleRemoveProduct(id, name) {
        var product = currentProducts.find(function (p) { return String(p.id) === String(id); });
        var willRestore = product && product.active === false;
        var confirmMessage = willRestore
            ? 'Restore "' + name + '" so it shows on the site again?'
            : 'Remove "' + name + '" from the site? Customers will no longer see it, but you can restore it later.';

        if (!window.confirm(confirmMessage)) return;

        client.from('products').update({ active: willRestore }).eq('id', id).then(function (res) {
            if (res.error) {
                alert('Could not update item: ' + res.error.message);
                return;
            }
            loadProducts();
        });
    }

    // ---- Wiring ----

    function init() {
        var url = window.BLERIS_SUPABASE_URL;
        var key = window.BLERIS_SUPABASE_ANON_KEY;

        if (!url || !key || typeof window.supabase === 'undefined') {
            showOnly('setupNotice');
            return;
        }

        client = window.supabase.createClient(url, key);

        client.auth.getSession().then(function (res) {
            if (res.data && res.data.session) {
                showDashboard();
            } else {
                showLogin();
            }
        });

        client.auth.onAuthStateChange(function (_event, session) {
            if (session) {
                showDashboard();
            } else {
                showLogin();
            }
        });

        $('loginForm').addEventListener('submit', function (e) {
            e.preventDefault();
            $('authError').textContent = '';
            var email = $('loginEmail').value.trim();
            var password = $('loginPassword').value;
            var submitBtn = $('loginSubmit');
            submitBtn.disabled = true;

            client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
                submitBtn.disabled = false;
                if (res.error) {
                    $('authError').textContent = res.error.message;
                }
            });
        });

        $('logoutBtn').addEventListener('click', function () {
            client.auth.signOut();
        });

        $('addNewBtn').addEventListener('click', function () {
            openForm(null);
        });

        $('cancelFormBtn').addEventListener('click', closeForm);

        $('productMediaFile').addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;

            var isVideo = file.type.indexOf('video/') === 0;
            var isImage = file.type.indexOf('image/') === 0;

            if (!isVideo && !isImage) {
                setMediaStatus('Please choose an image or video file.', true);
                e.target.value = '';
                return;
            }

            if (file.size > MAX_UPLOAD_BYTES) {
                setMediaStatus('That file is too large (max 50MB). Try a shorter clip or a smaller photo.', true);
                e.target.value = '';
                return;
            }

            var proceedWithUpload = function () {
                setMediaStatus('Uploading…');
                uploadMediaFile(file).then(function (result) {
                    $('productImage').value = result.url;
                    $('productMediaType').value = result.mediaType;
                    showMediaPreview(result.url, result.mediaType);
                    setMediaStatus('Uploaded.');
                }).catch(function (err) {
                    setMediaStatus('Upload failed: ' + (err && err.message ? err.message : 'unknown error'), true);
                });
            };

            if (isVideo) {
                getVideoDuration(file).then(function (duration) {
                    if (duration > MAX_VIDEO_SECONDS) {
                        var proceed = window.confirm(
                            'This clip is about ' + Math.round(duration) + ' seconds long (aim for ~30s). Upload it anyway?'
                        );
                        if (!proceed) {
                            e.target.value = '';
                            setMediaStatus('');
                            return;
                        }
                    }
                    proceedWithUpload();
                });
            } else {
                proceedWithUpload();
            }
        });

        $('productForm').addEventListener('submit', function (e) {
            e.preventDefault();
            saveProduct();
        });

        $('productList').addEventListener('click', function (e) {
            var editBtn = e.target.closest('.admin-edit-btn');
            var removeBtn = e.target.closest('.admin-remove-btn');
            if (editBtn) {
                openForm(editBtn.getAttribute('data-id'));
            } else if (removeBtn) {
                toggleRemoveProduct(removeBtn.getAttribute('data-id'), removeBtn.getAttribute('data-name'));
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
