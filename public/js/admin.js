(() => {
  const loginView = document.getElementById('loginView');
  const panelView = document.getElementById('panelView');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const serviceFields = document.getElementById('serviceFields');
  const servicesForm = document.getElementById('servicesForm');
  const saveMessage = document.getElementById('saveMessage');
  const loginButton = loginForm.querySelector('button[type="submit"]');
  const saveButton = servicesForm.querySelector('button[type="submit"]');

  const defaultServices = [
    { id: 'web-basic', title: 'Página web básica', description: 'Una presencia web clara para empezar a mostrar tu negocio o proyecto.', price: 100000, quote: false },
    { id: 'web-advanced', title: 'Página web avanzada', description: 'Más secciones y recursos para presentar mejor tus servicios.', price: 150000, quote: false },
    { id: 'web-pro', title: 'Página web profesional', description: 'Una web más completa, cuidada y adaptada a tus objetivos.', price: 200000, quote: false },
    { id: 'web-company', title: 'Página web de empresa', description: 'Presencia digital empresarial con estructura personalizada.', price: 300000, quote: false },
    { id: 'notebook-unlock', title: 'Desbloqueo de notebooks de gobierno', description: 'Consulta por desbloqueo y revisión según el modelo y estado del equipo.', price: 15000, quote: false },
    { id: 'windows-install', title: 'Instalación de Windows', description: 'Instalación del sistema operativo y configuración inicial.', price: 10000, quote: false },
    { id: 'pc-optimization', title: 'Optimización de PC', description: 'Revisión del equipo y evaluación del trabajo necesario antes de presupuestar.', price: null, quote: true }
  ];

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'No se pudo completar la operación.');
    return body;
  }

  function setMessage(element, text, success = false) {
    element.textContent = text;
    element.classList.toggle('success', success);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createField(service, index) {
    const card = element('article', 'service-field');
    card.dataset.id = service.id;
    const top = element('div', 'service-field-top');
    top.append(element('span', 'service-number', `${String(index + 1).padStart(2, '0')} / SERVICIO`));
    top.append(element('h2', '', service.title));
    card.append(top);

    const titleGroup = element('div', 'field-group');
    const titleLabel = element('label', 'field-label', 'Título del servicio');
    const titleInput = element('input');
    titleInput.type = 'text'; titleInput.name = 'title'; titleInput.value = service.title;
    titleInput.required = true; titleInput.maxLength = 80;
    titleLabel.htmlFor = `title-${service.id}`; titleInput.id = titleLabel.htmlFor;
    titleGroup.append(titleLabel, titleInput); card.append(titleGroup);

    const descGroup = element('div', 'field-group');
    const descLabel = element('label', 'field-label', 'Descripción');
    const descInput = element('textarea');
    descInput.name = 'description'; descInput.value = service.description;
    descInput.required = true; descInput.maxLength = 300; descInput.rows = 3;
    descLabel.htmlFor = `description-${service.id}`; descInput.id = descLabel.htmlFor;
    descGroup.append(descLabel, descInput); card.append(descGroup);

    const quoteLabel = element('label', 'price-quote-toggle');
    const quoteInput = element('input');
    quoteInput.type = 'checkbox'; quoteInput.name = 'quote'; quoteInput.checked = Boolean(service.quote);
    quoteLabel.append(quoteInput, element('span', '', 'Solicitar presupuesto (sin precio fijo)'));
    card.append(quoteLabel);

    const priceWrap = element('div', `price-input-wrap${service.quote ? ' is-disabled' : ''}`);
    const priceLabel = element('label', 'field-label', 'Precio en pesos argentinos (ARS)');
    const priceInput = element('input');
    priceInput.type = 'number'; priceInput.name = 'price'; priceInput.min = '1'; priceInput.max = '1000000000';
    priceInput.step = '1'; priceInput.value = service.price ?? ''; priceInput.required = !service.quote;
    priceInput.disabled = Boolean(service.quote);
    priceLabel.htmlFor = `price-${service.id}`; priceInput.id = priceLabel.htmlFor;
    priceWrap.append(priceLabel, priceInput); card.append(priceWrap);

    quoteInput.addEventListener('change', () => {
      priceInput.disabled = quoteInput.checked;
      priceInput.required = !quoteInput.checked;
      priceWrap.classList.toggle('is-disabled', quoteInput.checked);
      if (quoteInput.checked) priceInput.value = '';
      else if (!priceInput.value) priceInput.value = '0';
    });
    titleInput.addEventListener('input', () => {
      top.querySelector('h2').textContent = titleInput.value || 'Sin título';
    });
    return card;
  }

  function renderServices(services) {
    const fragment = document.createDocumentFragment();
    services.forEach((service, index) => fragment.append(createField(service, index)));
    serviceFields.replaceChildren(fragment);
  }

  async function showPanel() {
    const data = await request('/api/admin/services');
    renderServices(data.services);
    loginView.hidden = true;
    panelView.hidden = false;
    setMessage(saveMessage, 'Editá los campos y guardá para publicar los cambios.', false);
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginButton.disabled = true;
    setMessage(loginMessage, 'Verificando credenciales…');
    try {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      document.getElementById('password').value = '';
      await showPanel();
    } catch (error) {
      setMessage(loginMessage, error.message || 'Usuario o contraseña incorrectos.');
    } finally {
      loginButton.disabled = false;
    }
  });

  servicesForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    setMessage(saveMessage, 'Guardando cambios…');
    try {
      const services = [...serviceFields.querySelectorAll('.service-field')].map((card) => {
        const quote = card.querySelector('[name="quote"]').checked;
        return {
          id: card.dataset.id,
          title: card.querySelector('[name="title"]').value.trim(),
          description: card.querySelector('[name="description"]').value.trim(),
          quote,
          price: quote ? null : Number(card.querySelector('[name="price"]').value)
        };
      });
      for (const service of services) {
        if (service.title.length < 2) throw new Error('Cada servicio necesita un título de al menos 2 caracteres.');
        if (service.description.length < 5) throw new Error(`La descripción de “${service.title}” es demasiado corta.`);
        if (!service.quote && (!Number.isSafeInteger(service.price) || service.price < 1 || service.price > 1000000000)) {
          throw new Error(`Revisá el precio de “${service.title}”. Debe ser un número entero mayor que cero.`);
        }
      }
      await request('/api/admin/services', { method: 'PUT', body: JSON.stringify({ services }) });
      setMessage(saveMessage, 'Cambios guardados. La página pública ya muestra los nuevos datos.', true);
    } catch (error) {
      setMessage(saveMessage, error.message || 'No se pudieron guardar los cambios.');
    } finally {
      saveButton.disabled = false;
    }
  });

  document.getElementById('logoutButton').addEventListener('click', async () => {
    try { await request('/api/admin/logout', { method: 'POST', body: '{}' }); } catch (_) { /* cerrar interfaz igual */ }
    panelView.hidden = true;
    loginView.hidden = false;
    loginForm.reset();
    setMessage(loginMessage, 'Sesión cerrada.');
  });

  // If the browser already has a valid session cookie, resume the admin panel.
  request('/api/admin/services').then((data) => {
    renderServices(data.services);
    loginView.hidden = true;
    panelView.hidden = false;
    setMessage(saveMessage, 'Sesión activa. Podés seguir editando.', true);
  }).catch(() => {
    loginView.hidden = false;
    panelView.hidden = true;
  });

  // Available if the owner wants to restore the original example values from the UI.
  window.BLACKOUT_DEFAULT_SERVICES = defaultServices;
})();
