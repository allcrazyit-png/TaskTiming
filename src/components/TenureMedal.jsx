export function Badge({ tier, small = false, label }) {
    const id = tier;
    return <img
        className={`concept-badge ${small ? 'small' : ''}`}
        src={`${import.meta.env.BASE_URL}tenure-medals/${id}.svg`}
        alt={label}
        width="180"
        height="180"
        draggable={false}
    />;
}
