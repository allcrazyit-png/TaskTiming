import CatBuddyArt from './CatBuddyArt';
import NewBuddyArt from './NewBuddyArt';
export default function PetArtwork({ type = 'cat' }) {
    if (type === 'bear' || type === 'dog') return <NewBuddyArt species={type} />;
    return <CatBuddyArt />;
}
