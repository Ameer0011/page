export async function onRequest(context) {
  const target_id = "116900";
  const category = "4524";

  // ======================
  // Random Subdomain
  // ======================
  function generateRandomString(length = 12) {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let out = "";
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  // ======================
  // AES Decrypt
  // ======================
  function decrypt_text(base64) {
    const key_hex = "4E5C6D1A8B3FE8137A3B9DF26A9C4DE195267B8E6F6C0B4E1C3AE1D27F2B4E6F";
    const iv_hex  = "A9C21F8D7E6B4A9DB12E4F9D5C1A7B8E";

    const key = Uint8Array.from(Buffer.from(key_hex, "hex"));
    const iv  = Uint8Array.from(Buffer.from(iv_hex, "hex"));
    const encrypted = Buffer.from(base64, "base64");

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      cryptoKey,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }

  try {
    const sub = generateRandomString();
    const api_url = `https://${sub}.sa034.shop/api/v6.2/category/${category}?page=1`;

    const response = await fetch(api_url, {
      headers: {
        "id": "6f43d2474604ac2e",
        "user-agent": "Mozilla/5.0",
        "accept-encoding": "gzip"
      }
    });

    if (!response.ok) {
      return new Response("Bad Gateway", { status: 502 });
    }

    const encrypted = await response.text();
    const decrypted = await decrypt_text(encrypted);

    const data = JSON.parse(decrypted);

    if (!data?.data?.items) {
      return new Response("Server Error", { status: 500 });
    }

    for (const item of data.data.items) {
      if (item.id == target_id) {
        let url = item.source;

        if (url.startsWith("urlvplayer://")) {
          url = url.replace("urlvplayer://", "");
        }

        return Response.redirect(url, 302);
      }
    }

    return new Response("Not Found", { status: 404 });

  } catch (e) {
    return new Response("Error", { status: 500 });
  }
}
