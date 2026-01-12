// cppimport
#include <pybind11/pybind11.h>
#include <set>
#include <tuple>
#include <vector>
#include <array>
#include <thread>

namespace py = pybind11;

int square(int x) {
	return x * x;
}

std::tuple<int, int> floorRange(
    py::numpy_scalar<float> zb,
    py::numpy_scalar<float> zt,
    int floors,
    std::vector<py::numpy_scalar<float>> &flht
) {
    int l1 = 0;
    int r1 = floors - 1;
    int mid = 0;
    while (l1 < r1) {
        mid = (l1 + r1) / 2;
        if (flht.at(mid) < zb)
            l1 = mid + 1;
        else
            r1 = mid - 1;
    }
    int l2 = 0;
    int r2 = floors - 1;
    while (l2 < r2) {
        mid = (l2 + r2) / 2;
        if (flht.at(mid) < zt)
            l2 = mid + 1;
        else
            r2 = mid - 1;
    }
    if(flht.at(l1) < zb)
        l1++;
    if (flht.at(l2) > zt)
        l2--;
    return std::tuple<int, int>{l1, l2};
}

void splitFloorMultithreaded(
    // This is a disgusting datatype
    std::set<std::tuple<std::tuple<py::numpy_scalar<float>, py::numpy_scalar<float>, py::numpy_scalar<float>>, std::tuple<py::numpy_scalar<float>, py::numpy_scalar<float>, py::numpy_scalar<float>>>> &vectors,
    std::vector<std::vector<double>> &flpt,
    std::vector<py::numpy_scalar<float>>& flht
) {
}

void splitFloor(
    std::tuple<std::tuple<py::numpy_scalar<float>, py::numpy_scalar<float>, py::numpy_scalar<float>>, std::tuple<py::numpy_scalar<float>, py::numpy_scalar<float>, py::numpy_scalar<float>>> &vector,
    int floors,
    std::vector<std::array<py::numpy_scalar<float>, 3>> &flpt,
    std::vector<py::numpy_scalar<float>> &flht,
) {
    // pb, pt = vector
    // if pt[2] < pb[2]:
    //     pb, pt = pt, pb
    // # Finding the bottom and top most floor for vector and splitting floors in between
    // htotal = [pt[dim] - pb[dim] for dim in range(3)]
    // ib, it = floorRange(pb[2], pt[2])
    // if ib >= floors:
    //     return
    // bpercent, upercent = (flht[ib] - pb[2]) / htotal[2], (flht[it] - flht[ib]) / htotal[2]
    // xc, yc = pb[0] + (bpercent * htotal[0]), pb[1] + (bpercent * htotal[1])
    // vfloors = max(1, it - ib)
    // xh, yh = upercent * htotal[0] / vfloors, upercent * htotal[1] / vfloors
    // for i in range(ib, it + 1):
    //     with lock:
    //         flpt[i].append([xc, yc, 0])
    //         flct[i] += np.array([xc, yc])
    //         ax.scatter(xc, yc, flht[i])
    //     xc, yc = xc + xh, yc + yh
    std::tuple<py::numpy_scalar<float>, py::numpy_scalar<float>, py::numpy_scalar<float>> pb = std::get<0>(vector);
    std::tuple<py::numpy_scalar<float>, py::numpy_scalar<float>, py::numpy_scalar<float>> pt = std::get<1>(vector);
    std::array<py::numpy_scalar<float>, 3> htotal = {
        std::get<0>(pt) - std::get<0>(pb),
        std::get<1>(pt) - std::get<1>(pb),
        std::get<2>(pt) - std::get<2>(pb)
    };
    std::tuple<int, int> flRng = floorRange(std::get<2>(pb), std::get<2>(pt), floors, flht);
    if (std::get<0>(flRng) >= floors)
        return;

    py::numpy_scalar<float> bpercent = (flht.at(std::get<0>(flRng)) - std::get<2>(pb)) / htotal.at(2);
    py::numpy_scalar<float> upercent = (flht.at(std::get<1>(flRng)) - flht.at(std::get<0>(flRng))) / htotal.at(2);
}

PYBIND11_MODULE(pyext, m) {
	m.def("square", &square);
}

/*
<%
setup_pybind11(cfg)
%>
*/