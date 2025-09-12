// api/products.js
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') { res.statusCode = 405; return res.end('Method Not Allowed'); }

    const defaults = {
      shopName: 'Boutique',
      description: "Bienvenue dans la boutique. Produits démo.",
      faq: "Q: Livraison ?\nR: Par colis.\n\nQ: Paiement ?\nR: Cash ou crypto (redirigé vers contact humain en V1).",
      contactUsername: "TonContactHumain",
      logoUrl: "",
      bgUrl: "",
      privateMode: false,
      requiredChannel: "",
      channels: [],
      admins: [],
      deliveryForm: {
        fields: {
          firstname: true,
          lastname: true,
          address1: true,
          postalCode: true,
          city: true,
          country: true
        }
      }
    };

    let settings = await kv.get('settings');
    if (!settings) { settings = defaults; await kv.set('settings', settings); }
    else {
      // merge soft des defaults
      settings = { ...defaults, ...settings };
      settings.deliveryForm = {
        fields: { ...defaults.deliveryForm.fields, ...(settings.deliveryForm?.fields||{}) }
      };
      await kv.set('settings', settings);
    }

    let products = await kv.get('products');
    if (!products) {
      products = [
        { id: "p1", name: "Produit 1", unit: "1u = 100g", price_cash: 10, price_crypto: 9, description: "Démo produit 1", media: [] },
        { id: "p2", name: "Produit 2", unit: "1u = 100g", price_cash: 20, price_crypto: 18, description: "Démo produit 2", media: [] },
        { id: "p3", name: "Produit 3", unit: "1u = 100g", price_cash: 30, price_crypto: 27, description: "Démo produit 3", media: [] }
      ];
      await kv.set('products', products);
    }

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ settings, products }));
  } catch (e) {
    res.statusCode = 500;
    res.end('ERR_PRODUCTS:' + e.message);
  }
};
