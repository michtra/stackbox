from stl import mesh
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np
import threading
import math
import heapq

# Create a new plot
fig = plt.figure()

msh = mesh.Mesh.from_file('test/HalfDonut.stl')

print('Vectors: ', msh.vectors[0])
print('Points: ', msh.points[0])
print('Normals: ', msh.normals[0])

# ax = fig.add_subplot(2, 2, 1, projection='3d')

# for triangle in msh.vectors:
#     ax.plot([triangle[0][0], triangle[1][0]], [triangle[0][1], triangle[1][1]], [triangle[0][2], triangle[1][2]])
#     ax.plot([triangle[1][0], triangle[2][0]], [triangle[1][1], triangle[2][1]], [triangle[1][2], triangle[2][2]])
#     ax.plot([triangle[2][0], triangle[0][0]], [triangle[2][1], triangle[0][1]], [triangle[2][2], triangle[0][2]])

# ax.set_xlabel('X')
# ax.set_ylabel('Y')
# ax.set_zlabel('Z')

# ax = fig.add_subplot(2, 2, 2, projection='3d')

# If I just use the first vector in a triangle, some vectors are gone since there's no guarantee that these are ordered in some way
# for triangle in msh.vectors:
#     ax.plot([triangle[0][0], triangle[1][0]], [triangle[0][1], triangle[1][1]], [triangle[0][2], triangle[1][2]])

# ax.set_xlabel('X')
# ax.set_ylabel('Y')
# ax.set_zlabel('Z')

# ax = fig.add_subplot(2, 2, 3, projection='3d')
ax = fig.add_subplot(2, 2, 1, projection='3d')

vectors = set()

zmin, zmax = float('inf'), float('-inf')

# Duplicate vector filter
for triangle in msh.vectors:
    for p1, p2 in ((0, 1), (1, 2), (2, 0)):
        if not np.isclose(triangle[p1][2], triangle[p2][2]):
            vectors.add((tuple([triangle[p1][dim] for dim in range(3)]), tuple([triangle[p2][dim] for dim in range(3)])))

        if triangle[p1][2] > zmax:
            zmax = triangle[p1][2]
        elif triangle[p1][2] < zmin:
            zmin = triangle[p1][2]

print(zmin, zmax)

for vector in vectors:
    p1, p2 = vector
    ax.plot([p1[0], p2[0]], [p1[1], p2[1]], [p1[2], p2[2]])

ax.set_xlabel('X')
ax.set_ylabel('Y')
ax.set_zlabel('Z')

floors = 10
height = (zmax - zmin) / floors

flht = []
flpt = [[] for _ in range(floors)]
flct = np.zeros(shape=(floors, 2))

curr = zmin + (height / 2)
for _ in range(floors):
    flht.append(curr)
    curr += height
print(f'Heights: {flht}')

def floorRange(zb, zt):
    l1, r1 = 0, floors - 1
    while l1 < r1:
        mid = (l1 + r1) // 2
        if flht[mid] < zb:
            l1 = mid + 1
        else:
            r1 = mid - 1
    l2, r2 = 0, floors - 1
    while l2 < r2:
        mid = (l2 + r2) // 2
        if flht[mid] < zt:
            l2 = mid + 1
        else:
            r2 = mid - 1
    return ((l1 + 1 if flht[l1] < zb else l1), (l2 - 1 if flht[l2] > zt else l2))

# print(floorRange(0, 3.0))
# print(floorRange(flht[0], flht[-1]))
# print(floorRange(1, 2))
# print(floorRange(1, 1.03))
# print(floorRange(flht[3], flht[20]))

ax = fig.add_subplot(2, 2, 2, projection='3d')

# A less parallel version
# for vector in vectors:
#     pb, pt = vector
#     if pt[2] < pb[2]:
#         pb, pt = pt, pb
#     # Finding the bottom and top most floor for vector and splitting floors in between
#     htotal = [pt[dim] - pb[dim] for dim in range(3)]
#     ib, it = floorRange(pb[2], pt[2])
#     if ib >= floors:
#         continue
#     bpercent, upercent = (flht[ib] - pb[2]) / htotal[2], (flht[it] - flht[ib]) / htotal[2]
#     xc, yc = pb[0] + (bpercent * htotal[0]), pb[1] + (bpercent * htotal[1])
#     vfloors = max(1, it - ib)
#     xh, yh = upercent * htotal[0] / vfloors, upercent * htotal[1] / vfloors
#     for i in range(ib, it + 1):
#         flpt[i].add((xc, yc))
#         ax.scatter(xc, yc, flht[i])
#         xc, yc = xc + xh, yc + yh

def splitFloor(vector, flpt, ax, lock):
    pb, pt = vector
    if pt[2] < pb[2]:
        pb, pt = pt, pb
    # Finding the bottom and top most floor for vector and splitting floors in between
    htotal = [pt[dim] - pb[dim] for dim in range(3)]
    ib, it = floorRange(pb[2], pt[2])
    if ib >= floors:
        return
    bpercent, upercent = (flht[ib] - pb[2]) / htotal[2], (flht[it] - flht[ib]) / htotal[2]
    xc, yc = pb[0] + (bpercent * htotal[0]), pb[1] + (bpercent * htotal[1])
    vfloors = max(1, it - ib)
    xh, yh = upercent * htotal[0] / vfloors, upercent * htotal[1] / vfloors
    for i in range(ib, it + 1):
        with lock:
            flpt[i].append([xc, yc, 0])
            flct[i] += np.array([xc, yc])
            ax.scatter(xc, yc, flht[i])
        xc, yc = xc + xh, yc + yh

threads = []
lock = threading.Lock()
for vector in vectors:
    threads.append(threading.Thread(target=splitFloor, args=(vector, flpt, ax, lock)))
for t in threads:
    t.start()
for t in threads:
    t.join()

for i in range(floors):
    flct[i] /= len(flpt[i])

# Turning these points on floors into actual planes
# Realized this wouldn't work on non-convex buildings with multiple shapes, but so does the radial splitter in the frontend
def findRadian(i, j, lock):
    x, y = flpt[i][j][0] - flct[i][0], flpt[i][j][1] - flct[i][1]
    try:
        res = math.acos(x / math.sqrt((x * x) + (y * y)))
    except:
        print(x / ((x * x) + (y * y)))
        return
    with lock:
        flpt[i][j][2] = res if y >= 0 else (2 * math.pi) - res

threads = []
for i in range(floors):
    for j in range(len(flpt[i])):
        threads.append(threading.Thread(target=findRadian, args=(i, j, lock)))
for t in threads:
    t.start()
for t in threads:
    t.join()

for i in range(floors):
    flpt[i].sort(key=lambda x: x[2])

ax = fig.add_subplot(2, 2, 3, projection='3d')

for i in range(floors):
    flpt[i] = np.array(flpt[i])
    flpt[i][:,2] = flht[i]
    print(flpt[i], flht[i])

poly = Poly3DCollection(flpt)
ax.add_collection3d(poly)

ax.set_xlabel('X')
ax.set_ylabel('Y')
ax.set_zlabel('Z')

plt.show()