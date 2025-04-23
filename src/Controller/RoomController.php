<?php

namespace App\Controller;

use App\Entity\Room;
use App\Repository\RoomRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\String\Slugger\SluggerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class RoomController extends AbstractController
{
    private $entityManager;
    private $roomRepository;
    private $slugger;
    private $validator;
    private $hub;

    public function __construct(
        EntityManagerInterface $entityManager,
        RoomRepository $roomRepository,
        SluggerInterface $slugger,
        ValidatorInterface $validator,
        HubInterface $hub
    ) {
        $this->entityManager = $entityManager;
        $this->roomRepository = $roomRepository;
        $this->slugger = $slugger;
        $this->validator = $validator;
        $this->hub = $hub;
    }

    #[Route('/', name: 'app_home', methods: ['GET'])]
    public function home(): Response
    {
        $publicRooms = $this->roomRepository->findPublicRooms(10);
        
        $userRooms = [];
        $participatingRooms = [];
        
        if ($this->getUser()) {
            // Owned rooms
            $userRooms = $this->roomRepository->findBy(['owner' => $this->getUser()]);
            
            // Rooms user is participating in but not owning
            $participatingRooms = $this->roomRepository->findParticipatingRooms($this->getUser());
        }
        
        return $this->render('room/home.html.twig', [
            'publicRooms' => $publicRooms,
            'userRooms' => $userRooms,
            'participatingRooms' => $participatingRooms
        ]);
    }

    #[Route('/room/create', name: 'app_room_create', methods: ['GET', 'POST'])]
    #[IsGranted('ROLE_USER')]
    public function create(Request $request): Response
    {
        if ($request->isMethod('POST')) {
            $name = $request->request->get('name');
            $isPrivate = $request->request->getBoolean('is_private');
            $password = $request->request->get('password');
            
            $room = new Room();
            $room->setName($name);
            $room->setSlug($this->slugger->slug($name)->lower() . '-' . uniqid());
            $room->setOwner($this->getUser());
            $room->setIsPrivate($isPrivate);
            
            if ($isPrivate) {
                // If a private room is created, password is required
                if ($password) {
                    $room->setPassword($password);
                } else {
                    // Return with error if no password provided for private room
                    return $this->render('room/create.html.twig', [
                        'error' => 'Password is required for private rooms',
                        'form_data' => [
                            'name' => $name,
                            'is_private' => $isPrivate
                        ]
                    ]);
                }
            }
            
            $room->addParticipant($this->getUser());
            
            $errors = $this->validator->validate($room);
            if (count($errors) > 0) {
                // Return with validation errors
                return $this->render('room/create.html.twig', [
                    'errors' => $errors,
                ]);
            }
            
            $this->entityManager->persist($room);
            $this->entityManager->flush();
            
            return $this->redirectToRoute('app_room_show', ['slug' => $room->getSlug()]);
        }
        
        return $this->render('room/create.html.twig');
    }

    #[Route('/room/{slug}/edit-password', name: 'app_room_edit_password', methods: ['GET', 'POST'])]
    #[IsGranted('ROLE_USER')]
    public function editRoomPassword(Request $request, string $slug): Response
    {
        $room = $this->roomRepository->findOneBy(['slug' => $slug]);
        
        if (!$room) {
            throw $this->createNotFoundException('Room not found');
        }
        
        // Only the room owner can change the password
        if ($room->getOwner() !== $this->getUser()) {
            $this->addFlash('error', 'You must be the room owner to change the password');
            return $this->redirectToRoute('app_room_show', ['slug' => $slug]);
        }
        
        $success = null;
        $error = null;
        
        if ($request->isMethod('POST') && !$request->headers->has('Turbo-Frame')) {
            $newPassword = $request->request->get('new_password');
            
            if (!$newPassword) {
                $error = 'New password cannot be empty';
            } else {
                $room->setPassword($newPassword);
                $this->entityManager->flush();
                
                // Redirect after POST to prevent form resubmission issues with Turbo
                $this->addFlash('success', 'Room password has been updated successfully');
                return $this->redirectToRoute('app_room_edit_password', ['slug' => $slug]);
            }
        }
        
        // Show success flash messages
        if ($request->getSession()->getFlashBag()->has('success')) {
            $success = $request->getSession()->getFlashBag()->get('success')[0];
        }
        
        return $this->render('room/edit-password.html.twig', [
            'room' => $room,
            'success' => $success,
            'error' => $error
        ]);
    }

    #[Route('/room/{slug}/permission-check', name: 'app_room_permission_check', methods: ['GET'])]
    public function permissionCheck(string $slug): Response
    {
        $room = $this->roomRepository->findOneBy(['slug' => $slug]);
        
        if (!$room) {
            throw $this->createNotFoundException('Room not found');
        }
        
        if ($room->isIsPrivate() && !$this->isGranted('ROLE_USER')) {
            return $this->redirectToRoute('app_login');
        }
        
        if ($room->isIsPrivate() && !$room->getParticipants()->contains($this->getUser()) && $room->getOwner() !== $this->getUser()) {
            return $this->redirectToRoute('app_room_join', ['slug' => $slug]);
        }
        
        return $this->render('room/permission-check.html.twig', [
            'room' => $room
        ]);
    }

    #[Route('/room/{slug}/direct-access', name: 'app_room_direct_access', methods: ['GET'])]
    public function directAccess(string $slug): Response
    {
        $room = $this->roomRepository->findOneBy(['slug' => $slug]);
        
        if (!$room) {
            throw $this->createNotFoundException('Room not found');
        }
        
        if ($room->isIsPrivate() && !$this->isGranted('ROLE_USER')) {
            return $this->redirectToRoute('app_login');
        }
        
        if ($room->isIsPrivate() && !$room->getParticipants()->contains($this->getUser()) && $room->getOwner() !== $this->getUser()) {
            return $this->redirectToRoute('app_room_join', ['slug' => $slug]);
        }
        
        return $this->render('room/direct-access.html.twig', [
            'room' => $room
        ]);
    }

    #[Route('/room/{slug}', name: 'app_room_show', methods: ['GET'])]
    public function show(Request $request, string $slug): Response
    {
        $room = $this->roomRepository->findOneBy(['slug' => $slug]);
        
        if (!$room) {
            throw $this->createNotFoundException('Room not found');
        }
        
        if ($room->isIsPrivate() && !$this->isGranted('ROLE_USER')) {
            return $this->redirectToRoute('app_login');
        }
        
        if ($room->isIsPrivate() && !$room->getParticipants()->contains($this->getUser()) && $room->getOwner() !== $this->getUser()) {
            return $this->redirectToRoute('app_room_join', ['slug' => $slug]);
        }
        
        // Direct room access always
        if ($request->query->has('skip_check') || $request->headers->get('Turbo-Frame')) {
            // Log successful entry
            error_log('Entering room directly');
            
            try {
                return $this->render('room/show.html.twig', [
                    'room' => $room
                ]);
            } catch (\Exception $e) {
                // Log any rendering errors
                error_log('Error rendering room template: ' . $e->getMessage());
                throw $e;
            }
        }
        
        // Otherwise show options page
        return $this->redirectToRoute('app_room_direct_access', ['slug' => $slug]);
    }

    #[Route('/room/{slug}/join', name: 'app_room_join', methods: ['GET', 'POST'])]
    #[IsGranted('ROLE_USER')]
    public function join(Request $request, string $slug): Response
    {
        $room = $this->roomRepository->findOneBy(['slug' => $slug]);
        
        if (!$room) {
            throw $this->createNotFoundException('Room not found');
        }
        
        if (!$room->isIsPrivate() || $room->getParticipants()->contains($this->getUser()) || $room->getOwner() === $this->getUser()) {
            return $this->redirectToRoute('app_room_show', ['slug' => $slug]);
        }
        
        if ($request->isMethod('POST')) {
            $password = $request->request->get('password');
            
            if ($room->getPassword() === null || $room->getPassword() === $password) {
                $room->addParticipant($this->getUser());
                $this->entityManager->flush();
                
                // Notify room participants about new member via Mercure
                $update = new Update(
                    "room/{$room->getId()}",
                    json_encode([
                        'type' => 'user_joined',
                        'room' => $room->getId(),
                        'user' => [
                            'id' => $this->getUser()->getId(),
                            'username' => $this->getUser()->getUsername()
                        ]
                    ])
                );
                $this->hub->publish($update);
                
                return $this->redirectToRoute('app_room_show', ['slug' => $slug]);
            }
            
            // Wrong password
            return $this->render('room/join.html.twig', [
                'room' => $room,
                'error' => 'Invalid password'
            ]);
        }
        
        return $this->render('room/join.html.twig', [
            'room' => $room
        ]);
    }

    #[Route('/api/rooms', name: 'api_rooms_list', methods: ['GET'])]
    public function apiListRooms(): JsonResponse
    {
        $rooms = $this->roomRepository->findPublicRooms(50);
        
        $data = [];
        foreach ($rooms as $room) {
            $data[] = [
                'id' => $room->getId(),
                'name' => $room->getName(),
                'slug' => $room->getSlug(),
                'is_private' => $room->isIsPrivate(),
                'owner' => [
                    'id' => $room->getOwner()->getId(),
                    'username' => $room->getOwner()->getUsername()
                ],
                'participants_count' => $room->getParticipants()->count(),
                'created_at' => $room->getCreatedAt()->format('c')
            ];
        }
        
        return $this->json($data);
    }

    #[Route('/api/rooms', name: 'api_rooms_create', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function apiCreateRoom(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        
        if (!isset($data['name'])) {
            return $this->json(['error' => 'Name is required'], Response::HTTP_BAD_REQUEST);
        }
        
        $room = new Room();
        $room->setName($data['name']);
        $room->setSlug($this->slugger->slug($data['name'])->lower() . '-' . uniqid());
        $room->setOwner($this->getUser());
        $room->setIsPrivate($data['is_private'] ?? false);
        
        if (isset($data['is_private']) && $data['is_private'] && isset($data['password'])) {
            $room->setPassword($data['password']);
        }
        
        $room->addParticipant($this->getUser());
        
        $errors = $this->validator->validate($room);
        if (count($errors) > 0) {
            $errorMessages = [];
            foreach ($errors as $error) {
                $errorMessages[$error->getPropertyPath()] = $error->getMessage();
            }
            return $this->json(['errors' => $errorMessages], Response::HTTP_BAD_REQUEST);
        }
        
        $this->entityManager->persist($room);
        $this->entityManager->flush();
        
        return $this->json([
            'id' => $room->getId(),
            'name' => $room->getName(),
            'slug' => $room->getSlug(),
            'url' => $this->generateUrl('app_room_show', ['slug' => $room->getSlug()], UrlGeneratorInterface::ABSOLUTE_URL)
        ], Response::HTTP_CREATED);
    }

    #[Route('/api/rooms/{id}/join', name: 'api_room_join', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function apiJoinRoom(Request $request, int $id): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        
        if (!$room) {
            return $this->json(['error' => 'Room not found'], Response::HTTP_NOT_FOUND);
        }
        
        if ($room->getParticipants()->contains($this->getUser())) {
            return $this->json(['message' => 'Already a member of this room']);
        }
        
        $data = json_decode($request->getContent(), true);
        
        if ($room->isIsPrivate() && $room->getPassword() !== null) {
            if (!isset($data['password'])) {
                return $this->json(['error' => 'Password is required'], Response::HTTP_BAD_REQUEST);
            }
            
            if ($room->getPassword() !== $data['password']) {
                return $this->json(['error' => 'Invalid password'], Response::HTTP_UNAUTHORIZED);
            }
        }
        
        $room->addParticipant($this->getUser());
        $this->entityManager->flush();
        
        // Notify room participants about new member via Mercure
        $update = new Update(
            "room/{$room->getId()}",
            json_encode([
                'type' => 'user_joined',
                'room' => $room->getId(),
                'user' => [
                    'id' => $this->getUser()->getId(),
                    'username' => $this->getUser()->getUsername()
                ]
            ])
        );
        $this->hub->publish($update);
        
        return $this->json([
            'id' => $room->getId(),
            'name' => $room->getName(),
            'slug' => $room->getSlug(),
            'url' => $this->generateUrl('app_room_show', ['slug' => $room->getSlug()], UrlGeneratorInterface::ABSOLUTE_URL)
        ]);
    }
}