<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: '`user`')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180, unique: true)]
    private ?string $email = null;

    #[ORM\Column]
    private array $roles = [];

    #[ORM\Column]
    private ?string $password = null;

    #[ORM\Column(length: 255)]
    private ?string $username = null;

    #[ORM\OneToMany(mappedBy: 'owner', targetEntity: Room::class, orphanRemoval: true)]
    private Collection $ownedRooms;

    #[ORM\ManyToMany(targetEntity: Room::class, mappedBy: 'participants')]
    private Collection $participatingRooms;

    public function __construct()
    {
        $this->ownedRooms = new ArrayCollection();
        $this->participatingRooms = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    public function getUserIdentifier(): string
    {
        return (string) $this->email;
    }

    public function getRoles(): array
    {
        $roles = $this->roles;
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    public function setRoles(array $roles): static
    {
        $this->roles = $roles;

        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;

        return $this;
    }

    public function eraseCredentials(): void
    {
        // If you store any temporary, sensitive data on the user, clear it here
    }

    public function getUsername(): ?string
    {
        return $this->username;
    }

    public function setUsername(string $username): static
    {
        $this->username = $username;

        return $this;
    }

    /**
     * @return Collection<int, Room>
     */
    public function getOwnedRooms(): Collection
    {
        return $this->ownedRooms;
    }

    public function addOwnedRoom(Room $ownedRoom): static
    {
        if (!$this->ownedRooms->contains($ownedRoom)) {
            $this->ownedRooms->add($ownedRoom);
            $ownedRoom->setOwner($this);
        }

        return $this;
    }

    public function removeOwnedRoom(Room $ownedRoom): static
    {
        if ($this->ownedRooms->removeElement($ownedRoom)) {
            if ($ownedRoom->getOwner() === $this) {
                $ownedRoom->setOwner(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Room>
     */
    public function getParticipatingRooms(): Collection
    {
        return $this->participatingRooms;
    }

    public function addParticipatingRoom(Room $participatingRoom): static
    {
        if (!$this->participatingRooms->contains($participatingRoom)) {
            $this->participatingRooms->add($participatingRoom);
            $participatingRoom->addParticipant($this);
        }

        return $this;
    }

    public function removeParticipatingRoom(Room $participatingRoom): static
    {
        if ($this->participatingRooms->removeElement($participatingRoom)) {
            $participatingRoom->removeParticipant($this);
        }

        return $this;
    }
}