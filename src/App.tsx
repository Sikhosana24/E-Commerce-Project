
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

type Product = {
  id: number;
  title: string;
  description: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  brand: string;
  category: string;
  thumbnail: string;
  images: string[];
};

type CartItem = {
  id: number;
  title: string;
  price: number;
  discountPercentage: number;
  thumbnail: string;
  quantity: number;
};

type WishlistItem = {
  id: number;
  title: string;
  price: number;
  discountPercentage: number;
  thumbnail: string;
  brand: string;
};

type OrderDraft = {
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal: string;
  delivery: "standard" | "express";
  payment: "card" | "affirm" | "crypto";
  cardNumber: string;
  cardName: string;
  cardExpiry: string;
  cardCvv: string;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const apiBase = "https://dummyjson.com";

function discountedPrice(product: Pick<Product, "price" | "discountPercentage">) {
  return Math.round(product.price * (1 - product.discountPercentage / 100));
}

function normalizeCategories(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "name" in item) {
          const name = (item as { name?: string }).name;
          return typeof name === "string" ? name : "";
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

const emptyOrder: OrderDraft = {
  email: "",
  name: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  postal: "",
  delivery: "standard",
  payment: "card",
  cardNumber: "",
  cardName: "",
  cardExpiry: "",
  cardCvv: "",
};

function useScrollTopOnRouteChange() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
}

export default function App() {
  useScrollTopOnRouteChange();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const raw = localStorage.getItem("arcadia_cart");
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CartItem[];
    } catch {
      return [];
    }
  });
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => {
    const raw = localStorage.getItem("arcadia_wishlist");
    if (!raw) return [];
    try {
      return JSON.parse(raw) as WishlistItem[];
    } catch {
      return [];
    }
  });
  const [orderDraft, setOrderDraft] = useState<OrderDraft>(() => {
    const raw = localStorage.getItem("arcadia_order");
    if (!raw) return emptyOrder;
    try {
      return { ...emptyOrder, ...(JSON.parse(raw) as OrderDraft) };
    } catch {
      return emptyOrder;
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch(`${apiBase}/products?limit=100`, { signal: controller.signal }),
          fetch(`${apiBase}/products/categories`, { signal: controller.signal }),
        ]);
        if (!productsRes.ok) throw new Error("Failed to load products.");
        if (!categoriesRes.ok) throw new Error("Failed to load categories.");
        const productsData = (await productsRes.json()) as {
          products: Product[];
        };
        const categoriesData = (await categoriesRes.json()) as unknown;
        setProducts(productsData.products);
        setCategories(normalizeCategories(categoriesData));
        setStatus("success");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      }
    };
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    localStorage.setItem("arcadia_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("arcadia_wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem("arcadia_order", JSON.stringify(orderDraft));
  }, [orderDraft]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setCartOpen(false);
        setWishlistOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const filteredProducts = useMemo(() => {
    let next = products.slice();
    if (activeCategory !== "all") {
      next = next.filter((product) => product.category === activeCategory);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      next = next.filter((product) =>
        [product.title, product.brand, product.description]
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }
    switch (sort) {
      case "price-low":
        next.sort((a, b) => discountedPrice(a) - discountedPrice(b));
        break;
      case "price-high":
        next.sort((a, b) => discountedPrice(b) - discountedPrice(a));
        break;
      case "rating":
        next.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        next.sort((a, b) => b.id - a.id);
        break;
      default:
        next.sort(
          (a, b) =>
            b.discountPercentage + b.rating - (a.discountPercentage + a.rating)
        );
    }
    return next;
  }, [products, activeCategory, search, sort]);

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total + discountedPrice(item) * Math.max(1, item.quantity),
      0
    );
  }, [cart]);

  const cartCount = useMemo(
    () => cart.reduce((count, item) => count + item.quantity, 0),
    [cart]
  );

  const wishlistCount = useMemo(() => wishlist.length, [wishlist]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          title: product.title,
          price: product.price,
          discountPercentage: product.discountPercentage,
          thumbnail: product.thumbnail,
          quantity: 1,
        },
      ];
    });
    setCartOpen(true);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleWishlist = (product: Product) => {
    setWishlist((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) {
        return prev.filter((item) => item.id !== product.id);
      }
      return [
        {
          id: product.id,
          title: product.title,
          price: product.price,
          discountPercentage: product.discountPercentage,
          thumbnail: product.thumbnail,
          brand: product.brand,
        },
        ...prev,
      ];
    });
  };

  const isWishlisted = (id: number) => wishlist.some((item) => item.id === id);

  const featured = filteredProducts.slice(0, 12);

  return (
    <div className="app">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <p className="eyebrow">Arcadia Atelier</p>
            <h1>Future of Commerce</h1>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/market">Market</NavLink>
          <NavLink to="/wishlist">Wishlist</NavLink>
          <NavLink to="/checkout">Checkout</NavLink>
        </nav>
        <div className="header-actions">
          <button className="ghost" onClick={() => setWishlistOpen(true)}>
            Wishlist <span className="pill">{wishlistCount}</span>
          </button>
          <button className="ghost" onClick={() => setCartOpen(true)}>
            Cart <span className="pill">{cartCount}</span>
          </button>
          <button className="primary">Member Access</button>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <HomeView
              featured={featured}
              categories={categories}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              search={search}
              setSearch={setSearch}
              sort={sort}
              setSort={setSort}
              status={status}
              error={error}
              addToCart={addToCart}
              setSelected={setSelected}
              isWishlisted={isWishlisted}
              toggleWishlist={toggleWishlist}
            />
          }
        />
        <Route
          path="/market"
          element={
            <MarketView
              products={filteredProducts}
              categories={categories}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              search={search}
              setSearch={setSearch}
              sort={sort}
              setSort={setSort}
              status={status}
              error={error}
              addToCart={addToCart}
              setSelected={setSelected}
              isWishlisted={isWishlisted}
              toggleWishlist={toggleWishlist}
            />
          }
        />
        <Route
          path="/product/:id"
          element={
            <ProductDetailView
              products={products}
              status={status}
              addToCart={addToCart}
              toggleWishlist={toggleWishlist}
              isWishlisted={isWishlisted}
            />
          }
        />
        <Route
          path="/wishlist"
          element={
            <WishlistView
              wishlist={wishlist}
              setWishlistOpen={setWishlistOpen}
              addToCartById={(id) => {
                const product = products.find((item) => item.id === id);
                if (product) addToCart(product);
              }}
            />
          }
        />
        <Route
          path="/checkout"
          element={
            <CheckoutView
              cart={cart}
              cartTotal={cartTotal}
              orderDraft={orderDraft}
              setOrderDraft={setOrderDraft}
              onComplete={() => {
                setCart([]);
                setOrderDraft(emptyOrder);
              }}
            />
          }
        />
        <Route path="*" element={<NotFoundView />} />
      </Routes>

      <footer className="site-footer">
        <div>
          <h4>Arcadia Atelier</h4>
          <p className="muted">
            A premium ecommerce experience crafted with React, Vite, and the
            DummyJSON API.
          </p>
        </div>
        <div className="footer-grid">
          <div>
            <p className="eyebrow">Studio</p>
            <Link to="/">About</Link>
            <Link to="/">Careers</Link>
            <Link to="/">Press</Link>
          </div>
          <div>
            <p className="eyebrow">Client</p>
            <Link to="/">Concierge</Link>
            <Link to="/">Shipping</Link>
            <Link to="/">Returns</Link>
          </div>
          <div>
            <p className="eyebrow">Legal</p>
            <Link to="/">Privacy</Link>
            <Link to="/">Terms</Link>
            <Link to="/">Security</Link>
          </div>
        </div>
      </footer>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-media">
              <img src={selected.images?.[0] ?? selected.thumbnail} alt="" />
              <div className="thumb-row">
                {selected.images?.slice(0, 4).map((image) => (
                  <img key={image} src={image} alt="" />
                ))}
              </div>
            </div>
            <div className="modal-content">
              <p className="eyebrow">{selected.category}</p>
              <h3>{selected.title}</h3>
              <p className="muted">{selected.description}</p>
              <div className="rating">
                <span>★ {selected.rating.toFixed(1)}</span>
                <span className="muted">{selected.stock} in stock</span>
              </div>
              <div className="price-row">
                <span className="price">
                  {currency.format(discountedPrice(selected))}
                </span>
                <span className="price old">
                  {currency.format(selected.price)}
                </span>
              </div>
              <div className="modal-actions">
                <button className="ghost" onClick={() => setSelected(null)}>
                  Close
                </button>
                <Link className="ghost" to={`/product/${selected.id}`}>
                  Full Details
                </Link>
                <button className="primary" onClick={() => addToCart(selected)}>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Your Capsule</p>
                <h3>{cartCount} items</h3>
              </div>
              <button className="ghost" onClick={() => setCartOpen(false)}>
                Close
              </button>
            </div>
            {cart.length === 0 ? (
              <div className="empty-state">
                <h4>Your cart is empty.</h4>
                <p>Start curating a capsule from the market.</p>
              </div>
            ) : (
              <div className="cart-list">
                {cart.map((item) => (
                  <div className="cart-item" key={item.id}>
                    <img src={item.thumbnail} alt={item.title} />
                    <div>
                      <h4>{item.title}</h4>
                      <p className="muted">
                        {currency.format(discountedPrice(item))}
                      </p>
                      <div className="cart-actions">
                        <button onClick={() => updateQuantity(item.id, -1)}>
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)}>
                          +
                        </button>
                        <button
                          className="ghost"
                          onClick={() => removeItem(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="drawer-footer">
              <div>
                <p className="muted">Estimated total</p>
                <h3>{currency.format(cartTotal)}</h3>
              </div>
              <Link className="primary" to="/checkout">
                Proceed to Checkout
              </Link>
            </div>
          </aside>
        </div>
      )}

      {wishlistOpen && (
        <div className="drawer-backdrop" onClick={() => setWishlistOpen(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Wishlist</p>
                <h3>{wishlistCount} saved</h3>
              </div>
              <button className="ghost" onClick={() => setWishlistOpen(false)}>
                Close
              </button>
            </div>
            {wishlist.length === 0 ? (
              <div className="empty-state">
                <h4>No favorites yet.</h4>
                <p>Save products to build a capsule.</p>
              </div>
            ) : (
              <div className="cart-list">
                {wishlist.map((item) => (
                  <div className="cart-item" key={item.id}>
                    <img src={item.thumbnail} alt={item.title} />
                    <div>
                      <h4>{item.title}</h4>
                      <p className="muted">{item.brand}</p>
                      <div className="cart-actions">
                        <Link className="ghost" to={`/product/${item.id}`}>
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function HomeView({
  featured,
  categories,
  activeCategory,
  setActiveCategory,
  search,
  setSearch,
  sort,
  setSort,
  status,
  error,
  addToCart,
  setSelected,
  isWishlisted,
  toggleWishlist,
}: {
  featured: Product[];
  categories: string[];
  activeCategory: string;
  setActiveCategory: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  addToCart: (product: Product) => void;
  setSelected: (product: Product | null) => void;
  isWishlisted: (id: number) => boolean;
  toggleWishlist: (product: Product) => void;
}) {
  return (
    <main>
      <section className="hero" id="studio">
        <div className="hero-content">
          <p className="eyebrow">Curated by intelligence, shipped at speed.</p>
          <h2>
            A cinematic storefront where every product feels like a bespoke
            artifact.
          </h2>
          <p className="lead">
            Discover boundary-pushing lifestyle, tech, and beauty essentials
            sourced from the DummyJSON universe. Precision merchandising,
            smart personalization, and a cart that anticipates every move.
          </p>
          <div className="hero-actions">
            <button className="primary">Start a Capsule</button>
            <button className="ghost">Book a Private Drop</button>
          </div>
          <div className="hero-stats">
            <div>
              <span className="stat">24H</span>
              <p>Global fulfillment promise</p>
            </div>
            <div>
              <span className="stat">4.9</span>
              <p>Average community rating</p>
            </div>
            <div>
              <span className="stat">100+</span>
              <p>Curated SKUs live today</p>
            </div>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-card">
            <p className="eyebrow">Launch Capsule</p>
            <h3>Adaptive home, luminous beauty, precision gear.</h3>
            <p className="muted">
              Handpicked by Arcadia algorithms for the next seven days.
            </p>
            <button className="primary">View Capsule</button>
          </div>
          <div className="hero-glow" />
        </div>
      </section>

      <section className="feature-row" id="craft">
        <div className="feature">
          <h4>Intuitive Merchandising</h4>
          <p>
            Real-time price intelligence and editorial storytelling around
            every product.
          </p>
        </div>
        <div className="feature">
          <h4>Hyper-Personal Cart</h4>
          <p>
            Smart bundles, instant upgrades, and checkout that feels
            effortless.
          </p>
        </div>
        <div className="feature">
          <h4>Signature Service</h4>
          <p>
            Concierge fulfillment, premium packaging, and a global returns
            halo.
          </p>
        </div>
      </section>

      <section className="market" id="market">
        <MarketHeader
          search={search}
          setSearch={setSearch}
          sort={sort}
          setSort={setSort}
        />
        <CategoryRow
          categories={categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />
        <MarketGrid
          status={status}
          error={error}
          products={featured}
          addToCart={addToCart}
          setSelected={setSelected}
          isWishlisted={isWishlisted}
          toggleWishlist={toggleWishlist}
        />
      </section>

      <section className="cta" id="studio">
        <div>
          <p className="eyebrow">Arcadia Studio</p>
          <h3>Design your own collection in minutes.</h3>
          <p className="lead">
            Bundle products, craft custom pricing, and launch a shoppable
            capsule with concierge support.
          </p>
        </div>
        <button className="primary">Request a Build</button>
      </section>
    </main>
  );
}

function MarketView({
  products,
  categories,
  activeCategory,
  setActiveCategory,
  search,
  setSearch,
  sort,
  setSort,
  status,
  error,
  addToCart,
  setSelected,
  isWishlisted,
  toggleWishlist,
}: {
  products: Product[];
  categories: string[];
  activeCategory: string;
  setActiveCategory: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  addToCart: (product: Product) => void;
  setSelected: (product: Product | null) => void;
  isWishlisted: (id: number) => boolean;
  toggleWishlist: (product: Product) => void;
}) {
  return (
    <main>
      <section className="market" id="market">
        <div className="market-header split">
          <div>
            <p className="eyebrow">Live Market</p>
            <h3>Browse the latest drops</h3>
            <p className="muted">A full catalog of curated DummyJSON items.</p>
          </div>
          <Link className="ghost" to="/checkout">
            Go to Checkout
          </Link>
        </div>
        <MarketHeader
          search={search}
          setSearch={setSearch}
          sort={sort}
          setSort={setSort}
        />
        <CategoryRow
          categories={categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />
        <MarketGrid
          status={status}
          error={error}
          products={products}
          addToCart={addToCart}
          setSelected={setSelected}
          isWishlisted={isWishlisted}
          toggleWishlist={toggleWishlist}
        />
      </section>
    </main>
  );
}

function MarketHeader({
  search,
  setSearch,
  sort,
  setSort,
}: {
  search: string;
  setSearch: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
}) {
  return (
    <div className="market-header">
      <div>
        <p className="eyebrow">Live Market</p>
        <h3>Browse the latest drops</h3>
      </div>
      <div className="search-controls">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by brand, item, or vibe"
        />
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="featured">Featured</option>
          <option value="rating">Top Rated</option>
          <option value="newest">Newest</option>
          <option value="price-low">Price: Low</option>
          <option value="price-high">Price: High</option>
        </select>
      </div>
    </div>
  );
}

function CategoryRow({
  categories,
  activeCategory,
  setActiveCategory,
}: {
  categories: string[];
  activeCategory: string;
  setActiveCategory: (value: string) => void;
}) {
  return (
    <div className="category-row" id="collections">
      <button
        className={activeCategory === "all" ? "chip active" : "chip"}
        onClick={() => setActiveCategory("all")}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          className={activeCategory === category ? "chip active" : "chip"}
          onClick={() => setActiveCategory(category)}
        >
          {category.replace("-", " ")}
        </button>
      ))}
    </div>
  );
}

function MarketGrid({
  status,
  error,
  products,
  addToCart,
  setSelected,
  isWishlisted,
  toggleWishlist,
}: {
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  products: Product[];
  addToCart: (product: Product) => void;
  setSelected: (product: Product | null) => void;
  isWishlisted: (id: number) => boolean;
  toggleWishlist: (product: Product) => void;
}) {
  if (status === "loading") {
    return (
      <div className="grid">
        {Array.from({ length: 12 }).map((_, index) => (
          <div className="card skeleton" key={`sk-${index}`} />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="empty-state">
        <h4>We lost the signal.</h4>
        <p>{error}</p>
        <button className="primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="grid">
      {products.map((product) => {
        const finalPrice = discountedPrice(product);
        return (
          <article className="card" key={product.id}>
            <div className="card-media">
              <img src={product.thumbnail} alt={product.title} />
              <button
                className={
                  isWishlisted(product.id)
                    ? "wishlist-btn active"
                    : "wishlist-btn"
                }
                onClick={() => toggleWishlist(product)}
              >
                {isWishlisted(product.id) ? "Saved" : "Save"}
              </button>
              <span className="badge">
                {Math.round(product.discountPercentage)}% off
              </span>
            </div>
            <div className="card-body">
              <p className="eyebrow">{product.category}</p>
              <h4>{product.title}</h4>
              <p className="muted">{product.brand}</p>
              <div className="rating">
                <span>★ {product.rating.toFixed(1)}</span>
                <span className="muted">{product.stock} in stock</span>
              </div>
              <div className="price-row">
                <span className="price">{currency.format(finalPrice)}</span>
                <span className="price old">
                  {currency.format(product.price)}
                </span>
              </div>
            </div>
            <div className="card-actions">
              <button className="ghost" onClick={() => setSelected(product)}>
                Preview
              </button>
              <Link className="ghost" to={`/product/${product.id}`}>
                Details
              </Link>
              <button className="primary" onClick={() => addToCart(product)}>
                Add to Cart
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ProductDetailView({
  products,
  status,
  addToCart,
  toggleWishlist,
  isWishlisted,
}: {
  products: Product[];
  status: "idle" | "loading" | "success" | "error";
  addToCart: (product: Product) => void;
  toggleWishlist: (product: Product) => void;
  isWishlisted: (id: number) => boolean;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const product = products.find((item) => item.id === Number(id));

  if (status === "loading") {
    return (
      <main className="detail">
        <div className="detail-card skeleton" />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="detail">
        <div className="empty-state">
          <h4>We couldn't find that product.</h4>
          <button className="primary" onClick={() => navigate("/market")}>
            Back to Market
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="detail">
      <div className="detail-card">
        <div className="detail-media">
          <img src={product.images?.[0] ?? product.thumbnail} alt="" />
          <div className="thumb-row">
            {product.images?.slice(0, 5).map((image) => (
              <img key={image} src={image} alt="" />
            ))}
          </div>
        </div>
        <div className="detail-info">
          <p className="eyebrow">{product.category}</p>
          <h2>{product.title}</h2>
          <p className="lead">{product.description}</p>
          <div className="rating">
            <span>★ {product.rating.toFixed(1)}</span>
            <span className="muted">{product.stock} available</span>
          </div>
          <div className="price-row">
            <span className="price">
              {currency.format(discountedPrice(product))}
            </span>
            <span className="price old">
              {currency.format(product.price)}
            </span>
          </div>
          <div className="detail-actions">
            <button className="primary" onClick={() => addToCart(product)}>
              Add to Cart
            </button>
            <button className="ghost" onClick={() => toggleWishlist(product)}>
              {isWishlisted(product.id) ? "Saved" : "Save to Wishlist"}
            </button>
            <Link className="ghost" to="/checkout">
              Buy Now
            </Link>
          </div>
          <div className="detail-meta">
            <div>
              <p className="eyebrow">Brand</p>
              <p>{product.brand}</p>
            </div>
            <div>
              <p className="eyebrow">Ships in</p>
              <p>24 hours worldwide</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function WishlistView({
  wishlist,
  setWishlistOpen,
  addToCartById,
}: {
  wishlist: WishlistItem[];
  setWishlistOpen: (value: boolean) => void;
  addToCartById: (id: number) => void;
}) {
  return (
    <main className="wishlist">
      <div className="market-header">
        <div>
          <p className="eyebrow">Wishlist</p>
          <h3>Your saved Arcadia pieces</h3>
        </div>
        <button className="ghost" onClick={() => setWishlistOpen(true)}>
          Open Drawer
        </button>
      </div>
      {wishlist.length === 0 ? (
        <div className="empty-state">
          <h4>No favorites yet.</h4>
          <p>Save products to build your capsule.</p>
          <Link className="primary" to="/market">
            Explore Market
          </Link>
        </div>
      ) : (
        <div className="grid">
          {wishlist.map((item) => (
            <article className="card" key={item.id}>
              <div className="card-media">
                <img src={item.thumbnail} alt={item.title} />
              </div>
              <div className="card-body">
                <p className="eyebrow">Wishlist</p>
                <h4>{item.title}</h4>
                <p className="muted">{item.brand}</p>
                <div className="price-row">
                  <span className="price">
                    {currency.format(discountedPrice(item))}
                  </span>
                </div>
              </div>
              <div className="card-actions">
                <Link className="ghost" to={`/product/${item.id}`}>
                  Details
                </Link>
                <button className="primary" onClick={() => addToCartById(item.id)}>
                  Add to Cart
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function CheckoutView({
  cart,
  cartTotal,
  orderDraft,
  setOrderDraft,
  onComplete,
}: {
  cart: CartItem[];
  cartTotal: number;
  orderDraft: OrderDraft;
  setOrderDraft: (draft: OrderDraft) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const deliveryFee = orderDraft.delivery === "express" ? 24 : 0;
  const tax = Math.round(cartTotal * 0.08);
  const total = cartTotal + tax + deliveryFee;

  const next = () => setStep((prev) => Math.min(prev + 1, 4));
  const back = () => setStep((prev) => Math.max(prev - 1, 1));

  if (cart.length === 0) {
    return (
      <main className="checkout">
        <div className="empty-state">
          <h4>Your cart is empty.</h4>
          <p>Add products before checking out.</p>
          <Link className="primary" to="/market">
            Browse Market
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout">
      <div className="market-header">
        <div>
          <p className="eyebrow">Checkout</p>
          <h3>Finalize your capsule</h3>
        </div>
        <button className="ghost" onClick={() => navigate("/market")}>
          Continue Shopping
        </button>
      </div>

      <div className="checkout-grid">
        <section className="checkout-panel">
          <div className="stepper">
            {["Client", "Shipping", "Payment", "Review"].map((label, index) => (
              <div
                key={label}
                className={
                  step === index + 1
                    ? "step active"
                    : step > index + 1
                    ? "step complete"
                    : "step"
                }
              >
                <span>{index + 1}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="form-grid">
              <label>
                Email
                <input
                  value={orderDraft.email}
                  onChange={(event) =>
                    setOrderDraft({ ...orderDraft, email: event.target.value })
                  }
                  placeholder="you@arcadia.studio"
                />
              </label>
              <label>
                Full name
                <input
                  value={orderDraft.name}
                  onChange={(event) =>
                    setOrderDraft({ ...orderDraft, name: event.target.value })
                  }
                  placeholder="Nova Sterling"
                />
              </label>
              <label>
                Phone
                <input
                  value={orderDraft.phone}
                  onChange={(event) =>
                    setOrderDraft({ ...orderDraft, phone: event.target.value })
                  }
                  placeholder="(555) 902-2026"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="form-grid">
              <label>
                Address
                <input
                  value={orderDraft.address}
                  onChange={(event) =>
                    setOrderDraft({ ...orderDraft, address: event.target.value })
                  }
                  placeholder="101 Arcadia Lane"
                />
              </label>
              <label>
                City
                <input
                  value={orderDraft.city}
                  onChange={(event) =>
                    setOrderDraft({ ...orderDraft, city: event.target.value })
                  }
                  placeholder="San Francisco"
                />
              </label>
              <label>
                State
                <input
                  value={orderDraft.state}
                  onChange={(event) =>
                    setOrderDraft({ ...orderDraft, state: event.target.value })
                  }
                  placeholder="CA"
                />
              </label>
              <label>
                Postal code
                <input
                  value={orderDraft.postal}
                  onChange={(event) =>
                    setOrderDraft({ ...orderDraft, postal: event.target.value })
                  }
                  placeholder="94110"
                />
              </label>
              <div className="option-row">
                <button
                  className={
                    orderDraft.delivery === "standard"
                      ? "option active"
                      : "option"
                  }
                  onClick={() =>
                    setOrderDraft({ ...orderDraft, delivery: "standard" })
                  }
                >
                  Standard
                  <span>Included</span>
                </button>
                <button
                  className={
                    orderDraft.delivery === "express"
                      ? "option active"
                      : "option"
                  }
                  onClick={() =>
                    setOrderDraft({ ...orderDraft, delivery: "express" })
                  }
                >
                  Express
                  <span>{currency.format(24)}</span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-grid">
              <div className="option-row">
                <button
                  className={
                    orderDraft.payment === "card" ? "option active" : "option"
                  }
                  onClick={() =>
                    setOrderDraft({ ...orderDraft, payment: "card" })
                  }
                >
                  Card
                  <span>Visa, Amex, MasterCard</span>
                </button>
                <button
                  className={
                    orderDraft.payment === "affirm" ? "option active" : "option"
                  }
                  onClick={() =>
                    setOrderDraft({ ...orderDraft, payment: "affirm" })
                  }
                >
                  Affirm
                  <span>Pay in 4</span>
                </button>
                <button
                  className={
                    orderDraft.payment === "crypto" ? "option active" : "option"
                  }
                  onClick={() =>
                    setOrderDraft({ ...orderDraft, payment: "crypto" })
                  }
                >
                  Crypto
                  <span>USDC, ETH</span>
                </button>
              </div>
              {orderDraft.payment === "card" && (
                <>
                  <label>
                    Card number
                    <input
                      value={orderDraft.cardNumber}
                      onChange={(event) =>
                        setOrderDraft({
                          ...orderDraft,
                          cardNumber: event.target.value,
                        })
                      }
                      placeholder="4242 4242 4242 4242"
                    />
                  </label>
                  <label>
                    Cardholder name
                    <input
                      value={orderDraft.cardName}
                      onChange={(event) =>
                        setOrderDraft({
                          ...orderDraft,
                          cardName: event.target.value,
                        })
                      }
                      placeholder="Nova Sterling"
                    />
                  </label>
                  <label>
                    Expiry
                    <input
                      value={orderDraft.cardExpiry}
                      onChange={(event) =>
                        setOrderDraft({
                          ...orderDraft,
                          cardExpiry: event.target.value,
                        })
                      }
                      placeholder="02/28"
                    />
                  </label>
                  <label>
                    CVV
                    <input
                      value={orderDraft.cardCvv}
                      onChange={(event) =>
                        setOrderDraft({
                          ...orderDraft,
                          cardCvv: event.target.value,
                        })
                      }
                      placeholder="123"
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="review">
              <div>
                <h4>Client</h4>
                <p>{orderDraft.name}</p>
                <p>{orderDraft.email}</p>
                <p>{orderDraft.phone}</p>
              </div>
              <div>
                <h4>Shipping</h4>
                <p>{orderDraft.address}</p>
                <p>
                  {orderDraft.city}, {orderDraft.state} {orderDraft.postal}
                </p>
                <p>{orderDraft.delivery === "express" ? "Express" : "Standard"}</p>
              </div>
              <div>
                <h4>Payment</h4>
                <p>{orderDraft.payment.toUpperCase()}</p>
              </div>
            </div>
          )}

          <div className="checkout-actions">
            <button className="ghost" onClick={back} disabled={step === 1}>
              Back
            </button>
            {step < 4 ? (
              <button className="primary" onClick={next}>
                Continue
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => {
                  onComplete();
                  setStep(1);
                  navigate("/");
                }}
              >
                Place Order
              </button>
            )}
          </div>
        </section>

        <aside className="summary">
          <h4>Order Summary</h4>
          <div className="summary-list">
            {cart.map((item) => (
              <div key={item.id}>
                <span>{item.title}</span>
                <span>{currency.format(discountedPrice(item) * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{currency.format(cartTotal)}</span>
          </div>
          <div className="summary-row">
            <span>Tax</span>
            <span>{currency.format(tax)}</span>
          </div>
          <div className="summary-row">
            <span>Delivery</span>
            <span>{currency.format(deliveryFee)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{currency.format(total)}</span>
          </div>
          <p className="muted">All totals are estimates for showcase purposes.</p>
        </aside>
      </div>
    </main>
  );
}

function NotFoundView() {
  return (
    <main className="checkout">
      <div className="empty-state">
        <h4>Page not found.</h4>
        <Link className="primary" to="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
