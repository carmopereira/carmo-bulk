/**
 * JavaScript functions for the OrderForm block
 */
(function() {
	'use strict';
	
	// Global namespace for the plugin
	window.CarmoBulk = window.CarmoBulk || {};
	
	// Create functions in the namespace
	const CarmoBulk = window.CarmoBulk;
	
	const isDebug = typeof URLSearchParams !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

	document.addEventListener('DOMContentLoaded', function() {
		if (isDebug) console.log('🟢 OrderForm: Script initialized');
		
		// Initialize cart values
		updateQuantitiesFromCart();
		
		// Add event handlers for quantity buttons
		setupQuantityButtons();
		
		// Add handlers for the cart
		setupCartHandlers();
		
		// Initialize event handlers for category buttons
		handleCategoryApply();
		
		// Initialize lastValue for all inputs
		document.querySelectorAll('.carmo-bulk-quantity-input').forEach(input => {
			input.dataset.lastValue = input.value || '0';
		});
	});
	
	// Helper functions
	
	function setupQuantityButtons() {
		// Handler for product buttons
		document.body.addEventListener('click', async function(e) {
			const productButton = e.target.closest('.carmo-bulk-quantity-button');
			if (!productButton) return;
			
			e.preventDefault();
			
			// Find the table row (tr) first
			const row = productButton.closest('tr');
			if (!row) return;
			
			// Find the quantity input in the same row
			const input = row.querySelector('.carmo-bulk-quantity-input');
			if (!input) return;
			
			const currentValue = parseInt(input.value) || 0;
			let increment = 0;
			
			// Check which button was clicked
			if (productButton.classList.contains('carmo-bulk-product-plus-one')) increment = 1;
			else if (productButton.classList.contains('carmo-bulk-product-plus-five')) increment = 5;
			else if (productButton.classList.contains('carmo-bulk-product-plus-ten')) increment = 10;
			
			if (increment > 0) {
				const newValue = currentValue + increment;
				input.value = newValue;
				
				try {
					await handleQuantityChange(input, newValue);
					showNotification('Quantity updated successfully');
				} catch (error) {
					showNotification('Error updating quantity', 'error');
					input.value = currentValue; // Revert to previous value in case of error
				}
			}
		});
		
		if (isDebug) console.log('Quantity buttons configured');
	}
	
	function setupCartHandlers() {
		// Handler for keypress event on quantity inputs
		document.body.addEventListener('keypress', async function(e) {
			if (e.target.matches('.carmo-bulk-quantity-input') && e.key === 'Enter') {
				e.preventDefault(); // Prevent default Enter behavior
				
				const input = e.target;
				const newValue = parseInt(input.value) || 0;
				const oldValue = parseInt(input.dataset.lastValue) || 0;
				
				// If the value is zero and there is a cartItemKey, always process
				const cartItemKeyInput = input.closest('tr').querySelector('.carmo-bulk-cart-item-key');
				const cartItemKey = cartItemKeyInput ? cartItemKeyInput.value : '';
				const forceProcess = newValue === 0 && cartItemKey;
				
				// Process if the value changed OR if we're forcing removal with zero
				if (newValue !== oldValue || forceProcess) {
					try {
						const result = await handleQuantityChange(input, newValue);
						input.dataset.lastValue = newValue;
						if (result && result.removed) {
							showNotification('Product removed from cart');
						} else {
							showNotification('Quantity updated successfully');
						}
						input.blur(); // Remove focus from input
					} catch (error) {
						console.log('Error in keypress event', error);
						showNotification('Error updating quantity', 'error');
						input.value = oldValue; // Revert to previous value in case of error
					}
				} else {
					input.blur(); // Remove focus even if there's no change
				}
			}
		});
		
		// We also update the change event for consistency
		document.body.addEventListener('change', async function(e) {
			if (e.target.matches('.carmo-bulk-quantity-input')) {
				const input = e.target;
				const newValue = parseInt(input.value) || 0;
				const oldValue = parseInt(input.dataset.lastValue) || 0;
				
				const cartItemKeyInput = input.closest('tr').querySelector('.carmo-bulk-cart-item-key');
				const cartItemKey = cartItemKeyInput ? cartItemKeyInput.value : '';
				const forceProcess = newValue === 0 && cartItemKey;
				
				if (newValue !== oldValue || forceProcess) {
					try {
						const result = await handleQuantityChange(input, newValue);
						input.dataset.lastValue = newValue;
						if (result && result.removed) {
							showNotification('Product removed from cart');
						} else {
							showNotification('Quantity updated successfully');
						}
					} catch (error) {
						console.log('Error in change event', error);
						showNotification('Error updating quantity', 'error');
						input.value = oldValue;
					}
				}
			}
		});
		
		// Update the last valid value when the input loses focus
		document.body.addEventListener('blur', function(e) {
			if (e.target.matches('.carmo-bulk-quantity-input')) {
				const input = e.target;
				const currentValue = parseInt(input.value) || 0;
				input.dataset.lastValue = currentValue;
			}
		}, true);
		
		// Category reset button
		document.body.addEventListener('click', function(e) {
			// New listener for the category reset button
			if (e.target.matches('.carmo-bulk-category-reset-button')) {
				const categoryId = e.target.dataset.categoryId;
				console.log('Reset button clicked', { categoryId });
				
				if (categoryId) {
					resetCategory(categoryId).catch(error => {
						console.log('Error executing resetCategory', error);
					});
				} else {
					console.log('categoryId not found on the button');
				}
			}
		});
		
		if (isDebug) console.log('Cart handlers configured');
	}
	
	function handleCategoryApply() {
		const categoryApplyButtons = document.querySelectorAll('.carmo-bulk-category-apply-button');
		
		if (isDebug) console.log(`Found ${categoryApplyButtons.length} category apply buttons`);
		
		categoryApplyButtons.forEach(button => {
			button.addEventListener('click', function(event) {
				event.preventDefault();
				event.stopPropagation();
				
				const categoryId = this.dataset.categoryId;
				if (isDebug) console.log(`Category button ${categoryId} clicked`);
				
				// Search for the category input
				let categoryInput = document.querySelector(`.carmo-bulk-category-quantity-input[data-category-id="${categoryId}"]`);
				
				// If not found, try to find input near the button
				if (!categoryInput) {
					const parentElement = this.parentElement;
					if (parentElement) {
						categoryInput = parentElement.querySelector('input[type="number"]');
					}
				}
				
				// Determine the value to be applied
				let valueToApply = '1';  // Default value
				
				if (categoryInput && categoryInput.value && categoryInput.value !== '') {
					valueToApply = categoryInput.value;
					if (isDebug) console.log(`Value to be applied: ${valueToApply}`);
				} else {
					if (isDebug) console.log(`No valid input found. Using default value: ${valueToApply}`);
				}
				
				// Find all inputs for the category
				const categoryInputs = document.querySelectorAll(`.carmo-bulk-quantity-input[data-category-id="${categoryId}"]`);
				
				if (categoryInputs.length === 0) {
					if (isDebug) console.log(`No product inputs found for category'. ${categoryId}`);
					alert(`Error: Could not find products for this category (${categoryId})`);
					return;
				}
				
				if (isDebug) console.log(`Applying value ${valueToApply} to ${categoryInputs.length} products in category ${categoryId}`);
				
				// Apply the value to all products sequentially
				applyValueSequentially(Array.from(categoryInputs), 0, valueToApply, categoryId);
			});
		});
	}
	
	/**
	 * Applies a specific value to inputs sequentially
	 */
	function applyValueSequentially(inputs, index, valueToApply, categoryId) {
		// If finished all inputs
		if (index >= inputs.length) {
			if (isDebug) console.log(`Updated ${inputs.length} products in category ${categoryId}`);
			return;
		}
		
		const input = inputs[index];
		const productId = input.dataset.productId;
		const oldValue = input.value;
		
		if (isDebug) console.log(`[${index+1}/${inputs.length}]: Applying value ${valueToApply} to product ${productId} (previous value: ${oldValue})`);
		
		try {
			// First set the value explicitly in the input
			input.value = valueToApply;
			
			// Then trigger the change event
			handleQuantityChange(input, valueToApply);
			
			// Process the next one after a small delay
			setTimeout(function() {
				applyValueSequentially(inputs, index + 1, valueToApply, categoryId);
			}, 400);
			
			// Add notification
			if (index === inputs.length - 1) {
				// Using the last input as a reference for the block container
				showNotification(`Applied value ${valueToApply} to all products in the category`, 'success', input);
			}
		} catch (e) {
			console.error(`Error applying value: ${e.message}`);
			showNotification('Error applying value to products', 'error', input);
		}
	}
	
	/**
	 * Category reset
	 */
	async function resetCategory(categoryId) {
		if (isDebug) console.log('Starting resetCategory', { categoryId });
		
		// Find all quantity inputs for this category
		const categoryInputs = document.querySelectorAll(`.carmo-bulk-quantity-input[data-category-id="${categoryId}"]`);
		
		if (!categoryInputs.length) {
			if (isDebug) console.log('No products found in the category');
			return;
		}
		
		let promises = [];
		let productsRemoved = 0;
		let itemsToRemove = [];
		
		// First we collect all items that need to be removed
		for (const input of categoryInputs) {
			const row = input.closest('tr');
			if (!row) continue;
			
			// We zero the input in any case
			input.value = 0;
			input.dataset.lastValue = 0;
			
			// Check if cartItemKey exists
			const cartItemKeyInput = row.querySelector('.carmo-bulk-cart-item-key');
			if (!cartItemKeyInput || !cartItemKeyInput.value) {
				continue; // Not in the cart, skip to the next one
			}
			
			const cartItemKey = cartItemKeyInput.value;
			itemsToRemove.push({
				input: input,
				cartItemKey: cartItemKey,
				cartItemKeyInput: cartItemKeyInput,
				productId: input.dataset.productId
			});
		}
		
		if (isDebug) console.log('Items to remove', itemsToRemove.length);
		
		// Now we remove one by one, sequentially to avoid issues
		for (const item of itemsToRemove) {
			try {
				if (isDebug) console.log('Removing item from cart', item.cartItemKey, 'product ID:', item.productId);
				await removeFromCart(item.cartItemKey);
				
				// Clear the cartItemKey
				item.cartItemKeyInput.value = '';
				productsRemoved++;
				
				// Small pause to ensure the server processes each removal
				await new Promise(resolve => setTimeout(resolve, 800));
			} catch (error) {
				if (isDebug) console.log('Error removing product', { 
					cartItemKey: item.cartItemKey, 
					productId: item.productId, 
					error 
				});
			}
		}
		
		if (productsRemoved > 0) {
			showNotification(`${productsRemoved} products removed from category`);

			const customEvent = new CustomEvent('wc-blocks_added_to_cart');
			document.body.dispatchEvent(customEvent);
		} else {
			showNotification('No products in cart to remove');
		}
	}
	
	// Main function for handling quantity changes
	function handleQuantityChange(input, newValue) {
		if (!input) {
			return Promise.reject(new Error('Input not found'));
		}
		
		const productId = input.dataset.productId;
		
		if (isDebug) console.log('Changing quantity for product', {
			productId: productId,
			newValue: newValue,
			inputValue: input.value
		});
		
		if (!productId) {
			if (isDebug) console.error('Product ID not found in input:', input);
			return Promise.reject(new Error('Product ID not found'));
		}
		
		const row = input.closest('tr');
		if (!row) {
			return Promise.reject(new Error('Table row not found'));
		}
		
		const cartItemKeyInput = row.querySelector('.carmo-bulk-cart-item-key');
		const cartItemKey = cartItemKeyInput ? cartItemKeyInput.value : '';
		
		// If the quantity is zero and we have a cartItemKey, we remove the item
		if (newValue === 0 && cartItemKey) {
			return removeFromCart(cartItemKey).then(() => {
				if (cartItemKeyInput) {
					cartItemKeyInput.value = '';
				}
				return { removed: true };
			});
		}
		
		// Passar o ID da variação para a função updateCart
		return updateCart(productId, newValue, cartItemKey).then(response => {
			// Update the cartItemKey after the operation is successful
			if (response && response.key) {
				// If the input for cartItemKey doesn't exist, we create one
				if (!cartItemKeyInput) {
					const newCartItemKeyInput = document.createElement('input');
					newCartItemKeyInput.type = 'hidden';
					newCartItemKeyInput.className = 'carmo-bulk-cart-item-key';
					row.querySelector('.carmo-bulk-product-quantity').appendChild(newCartItemKeyInput);
					newCartItemKeyInput.value = response.key;
				} else {
					cartItemKeyInput.value = response.key;
				}
			}
			return response;
		});
	}
	
	// Function to remove item from cart
	function removeFromCart(cartItemKey) {
		if (isDebug) console.log('Removing item from cart', {
			cartItemKey: cartItemKey
		});
		
		return new Promise((resolve, reject) => {
			if (!cartItemKey) {
				//console.error('No cart item key provided for removal');
				return reject(new Error('No cart item key provided'));
			}
			
			jQuery.ajax({
				url: '/wp-json/wc/store/v1/cart/items/' + cartItemKey,
				method: 'DELETE',
				beforeSend: function(xhr) {
					xhr.setRequestHeader('X-WC-Store-API-Nonce', document.getElementById('carmo-bulk-form').dataset.nonce);
				},
				success: function(response) {
					if (isDebug) console.log('Item successfully removed', response);
					resolve(response);

					const customEvent = new CustomEvent('wc-blocks_added_to_cart');
					document.body.dispatchEvent(customEvent);
				},
				error: function(error) {
					if (isDebug) console.log('Error removing item', error);
					reject(error);
				}
			});
		});
	}
	
	function updateCart(productId, quantity, cartItemKey) {
		if (isDebug) console.log('Starting updateCart', {productId,	quantity, cartItemKey});
		
		return new Promise((resolve, reject) => {
			const data = {
				id: productId,
				quantity: quantity
			};
					
			let ajaxConfig = {
				beforeSend: function(xhr) {
					xhr.setRequestHeader('X-WC-Store-API-Nonce', document.getElementById('carmo-bulk-form').dataset.nonce);
				},
				data: JSON.stringify(data),
				contentType: 'application/json',
				success: function(response) {
					if (isDebug) console.log('Update successful', response);
					resolve(response);

					const customEvent = new CustomEvent('wc-blocks_added_to_cart');
					document.body.dispatchEvent(customEvent);
				},
				error: function(error) {
					if (isDebug) console.log('Update error', error);
					reject(error);
				}
			};
			
			if (cartItemKey) {
				if (isDebug) console.log('Updating existing item', cartItemKey);
				jQuery.ajax({
					...ajaxConfig,
					url: '/wp-json/wc/store/v1/cart/items/' + cartItemKey,
					method: 'PUT'
				});
			} else {
				if (isDebug) console.log('Adding new item');
				jQuery.ajax({
					...ajaxConfig,
					url: '/wp-json/wc/store/v1/cart/items',
					method: 'POST'
				});
			}
		});
	}
	
	/**
	 * Shows a notification inside the block container
	 */
	function showNotification(message, type = 'success', triggerElement = null) {
		// Find the block that contains the element that triggered the action
		let blockContainer;
		
		if (triggerElement) {
			// Search for the closest block container
			blockContainer = triggerElement.closest('.carmo-bulk-container');
		}
		
		// If container not found from the trigger element
		if (!blockContainer) {
			// Try to use the currently focused element
			const activeElement = document.activeElement;
			if (activeElement) {
				blockContainer = activeElement.closest('.carmo-bulk-container');
			}
		}
		
		// If still not found, try the first block as a fallback
		if (!blockContainer) {
			blockContainer = document.querySelector('.carmo-bulk-container');
		}
		
		// If really didn't find any container, do nothing
		if (!blockContainer) {
			console.error('Error: Could not find a block container for notification');
			return;
		}
		
		// Get or create notification in the container
		let notification = blockContainer.querySelector('.carmo-bulk-notification');
		
		// If notification element doesn't exist, create one
		if (!notification) {
			notification = document.createElement('div');
			notification.className = 'carmo-bulk-notification';
			blockContainer.appendChild(notification);
		}
		
		// Configure the notification
		notification.textContent = message;
		notification.className = `carmo-bulk-notification ${type}`;
		notification.style.display = 'block';
		
		// Hide after 3 seconds
		setTimeout(() => {
			notification.style.display = 'none';
		}, 3000);
	}
	
	// Initialize cart values
	function updateQuantitiesFromCart() {
		if (isDebug) console.log('Starting updateQuantitiesFromCart');
		
		// Use the WooCommerce Store API endpoint
		jQuery.ajax({
			url: '/wp-json/wc/store/v1/cart',
			type: 'GET',
			beforeSend: function(xhr) {
				const nonceElement = document.getElementById('carmo-bulk-form');
				if (nonceElement && nonceElement.dataset.nonce) {
					xhr.setRequestHeader('X-WC-Store-API-Nonce', nonceElement.dataset.nonce);
				}
			},
			success: function(response) {
				if (isDebug) console.log('Store API response received');
				
				// Map products in cart
				const productsInCart = {};
				
				if (response && response.items && Array.isArray(response.items)) {
					if (isDebug) console.log('Found', response.items.length, 'items in cart');
					
					response.items.forEach(item => {
						// ID pode ser o product_id para produtos simples ou variation_id para variáveis
						const productId = item.id || 
									(item.product_id ? item.product_id.toString() : null) || 
									(item.product && item.product.id ? item.product.id.toString() : null);
						
						// Verificar se é um produto variável (possui variation_id)
						const variationId = item.variation_id || 
									(item.variation && item.variation.id ? item.variation.id.toString() : null);
												
						if (productId) {
							// Usar o variation_id como chave se for um produto variável
							const mapKey = variationId ? `${productId}_${variationId}` : productId;
							
							productsInCart[mapKey] = {
								productId: productId,
								variationId: variationId,
								quantity: item.quantity,
								key: item.key
							};
						}
					});
				} else {
					if (isDebug) console.log('Unrecognized response structure or empty cart');
				}
				
				// Find all quantity inputs
				const inputs = document.querySelectorAll('.carmo-bulk-quantity-input');
				if (isDebug) console.log('Total inputs found', inputs.length);
				
				// Reset all inputs first (zerar os campos)
				inputs.forEach(function(input) {
					input.value = 0;
					input.dataset.lastValue = 0;
					
					// Remover o cart item key, se existir
					const row = input.closest('tr');
					if (row) {
						const cartItemKeyInput = row.querySelector('.carmo-bulk-cart-item-key');
						if (cartItemKeyInput) {
							cartItemKeyInput.value = '';
						}
					}
				});
				
				// Atualizar com os valores do carrinho
				inputs.forEach(function(input) {
					const productId = input.dataset.productId;
					const variationId = input.dataset.variationId;
					const row = input.closest('tr');
					if (!row) return;
					
					// Determinar a chave a ser usada no mapa
					let mapKey = productId;
					
					// Se o input tem variation_id, usar a combinação product_variation como chave
					if (variationId) {
						mapKey = `${productId}_${variationId}`;
					}
					
					// Verificar se o produto está no carrinho
					if (productsInCart[mapKey]) {
						const cartInfo = productsInCart[mapKey];
						
						// Atualizar o input com a quantidade
						input.value = cartInfo.quantity;
						input.dataset.lastValue = cartInfo.quantity;
						
						// Atualizar ou criar o cartItemKey
						let cartItemKeyInput = row.querySelector('.carmo-bulk-cart-item-key');
						if (!cartItemKeyInput) {
							cartItemKeyInput = document.createElement('input');
							cartItemKeyInput.className = 'carmo-bulk-cart-item-key';
							cartItemKeyInput.type = 'hidden';
							cartItemKeyInput.name = 'product-quantity.' + (productId || '');
							row.querySelector('.carmo-bulk-product-quantity').appendChild(cartItemKeyInput);
						}
						
						cartItemKeyInput.value = cartInfo.key;
					}
				});

				const customEvent = new CustomEvent('wc-blocks_added_to_cart');
				document.body.dispatchEvent(customEvent);
			},
			error: function(error) {
				if (isDebug) console.log('Error getting cart via Store API', error);
				
				// Try alternative method as fallback
				if (typeof wc_cart_fragments_params !== 'undefined') {
					jQuery.ajax({
						url: wc_cart_fragments_params.wc_ajax_url.toString().replace('%%endpoint%%', 'get_refreshed_fragments'),
						type: 'POST',
						success: function(data) {
							if (isDebug) console.log('Fragments obtained');
							
							// Update fragments
							if (data && data.fragments) {
								jQuery.each(data.fragments, function(key, value) {
									jQuery(key).replaceWith(value);
								});
							}
							
							// Trigger WooCommerce events
							jQuery(document.body).trigger('wc_fragments_refreshed');
							jQuery(document.body).trigger('updated_cart_totals');
						}
					});
				}
			}
		});
	}
	
})();
