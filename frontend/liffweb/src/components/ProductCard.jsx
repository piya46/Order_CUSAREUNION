// src/components/ProductCard.jsx
import { firstImageUrl } from '../utils/img';

export default function ProductCard({ product, onClick }) {
  const cover = firstImageUrl(product);
  return (
    <div className="product-card" onClick={onClick}>
      {cover ? (
        <img src={cover} alt={product.name} />
      ) : (
        <div className="placeholder">No Image</div>
      )}
      <div className="meta">
        <div className="name">{product.name}</div>
      </div>
    </div>
  );
}