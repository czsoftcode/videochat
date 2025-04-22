<?php

namespace App\Controller;

use App\Entity\Room;
use App\Repository\RoomRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

class VideoController extends AbstractController
{
    private $roomRepository;
    private $hub;

    public function __construct(
        RoomRepository $roomRepository,
        HubInterface $hub
    ) {
        $this->roomRepository = $roomRepository;
        $this->hub = $hub;
    }

    #[Route('/api/rooms/{id}/signal', name: 'api_room_signal', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function signal(Request $request, int $id): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        
        if (!$room) {
            return $this->json(['error' => 'Room not found'], Response::HTTP_NOT_FOUND);
        }
        
        if (!$room->getParticipants()->contains($this->getUser()) && $room->getOwner() !== $this->getUser()) {
            return $this->json(['error' => 'You are not a member of this room'], Response::HTTP_FORBIDDEN);
        }
        
        $data = json_decode($request->getContent(), true);
        
        if (!isset($data['signal']) || !isset($data['to'])) {
            return $this->json(['error' => 'Missing required fields'], Response::HTTP_BAD_REQUEST);
        }
        
        // Broadcast the signaling data to all participants in the room via Mercure
        // The 'to' field specifies the target user ID
        $signalData = [
            'type' => 'signal',
            'from' => [
                'id' => $this->getUser()->getId(),
                'username' => $this->getUser()->getUsername()
            ],
            'signal' => $data['signal'],
            'to' => $data['to'] // Target user ID
        ];
        
        // Create a Mercure update targeting the specific room
        $update = new Update(
            "room/{$room->getId()}",
            json_encode($signalData)
        );
        
        // Publish the update
        $this->hub->publish($update);
        
        return $this->json(['message' => 'Signal sent successfully']);
    }

    #[Route('/api/rooms/{id}/participants', name: 'api_room_participants', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function getParticipants(int $id): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        
        if (!$room) {
            return $this->json(['error' => 'Room not found'], Response::HTTP_NOT_FOUND);
        }
        
        if (!$room->getParticipants()->contains($this->getUser()) && $room->getOwner() !== $this->getUser()) {
            return $this->json(['error' => 'You are not a member of this room'], Response::HTTP_FORBIDDEN);
        }
        
        $participants = [];
        foreach ($room->getParticipants() as $participant) {
            $participants[] = [
                'id' => $participant->getId(),
                'username' => $participant->getUsername(),
                'is_owner' => $room->getOwner() === $participant
            ];
        }
        
        return $this->json($participants);
    }

    #[Route('/api/rooms/{id}/announce', name: 'api_room_announce', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function announcePresence(int $id): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        
        if (!$room) {
            return $this->json(['error' => 'Room not found'], Response::HTTP_NOT_FOUND);
        }
        
        if (!$room->getParticipants()->contains($this->getUser()) && $room->getOwner() !== $this->getUser()) {
            return $this->json(['error' => 'You are not a member of this room'], Response::HTTP_FORBIDDEN);
        }
        
        // Announce user presence to all participants in the room
        $update = new Update(
            "room/{$room->getId()}",
            json_encode([
                'type' => 'user_present',
                'room' => $room->getId(),
                'user' => [
                    'id' => $this->getUser()->getId(),
                    'username' => $this->getUser()->getUsername(),
                    'is_owner' => $room->getOwner() === $this->getUser()
                ]
            ])
        );
        
        $this->hub->publish($update);
        
        return $this->json(['message' => 'Presence announced successfully']);
    }

    #[Route('/api/rooms/{id}/leave', name: 'api_room_leave', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function leaveRoom(int $id): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        
        if (!$room) {
            return $this->json(['error' => 'Room not found'], Response::HTTP_NOT_FOUND);
        }
        
        if (!$room->getParticipants()->contains($this->getUser())) {
            return $this->json(['message' => 'You are not in this room']);
        }
        
        // If user is the owner, don't allow leaving (should transfer ownership or delete room instead)
        if ($room->getOwner() === $this->getUser()) {
            return $this->json(['error' => 'Room owner cannot leave. Transfer ownership or delete the room.'], Response::HTTP_BAD_REQUEST);
        }
        
        $room->removeParticipant($this->getUser());
        $this->entityManager->flush();
        
        // Notify others that user has left
        $update = new Update(
            "room/{$room->getId()}",
            json_encode([
                'type' => 'user_left',
                'room' => $room->getId(),
                'user' => [
                    'id' => $this->getUser()->getId(),
                    'username' => $this->getUser()->getUsername()
                ]
            ])
        );
        
        $this->hub->publish($update);
        
        return $this->json(['message' => 'You have left the room']);
    }
}